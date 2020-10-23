/* Copyright (c) 2020, VRAI Labs and/or its affiliates. All rights reserved.
 *
 * This software is licensed under the Apache License, Version 2.0 (the
 * "License") as published by the Apache Software Foundation.
 *
 * You may not use this file except in compliance with the License. You may
 * obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

import RecipeModule from "../../recipeModule";
import { TypeInput, TypeNormalisedInput } from "./types";
import STError from "./error";
import Session from "./sessionClass";
import { validateAndNormaliseUserInput, attachCreateOrRefreshSessionResponseToExpressRes } from "./utils";
import { HandshakeInfo, NormalisedErrorHandlers } from "./types";
import * as express from "express";
import * as SessionFunctions from "./sessionFunctions";
import {
    attachAccessTokenToCookie,
    clearSessionFromCookie,
    getAccessTokenFromCookie,
    getAntiCsrfTokenFromHeaders,
    getIdRefreshTokenFromCookie,
    getRefreshTokenFromCookie,
    getCORSAllowedHeaders as getCORSAllowedHeadersFromCookiesAndHeaders,
    setFrontTokenInHeaders,
} from "./cookieAndHeaders";
import axios from "axios";
import { NormalisedAppinfo, RecipeListFunction, APIHandled } from "../../types";
import { normaliseURLPathOrThrowError } from "../../utils";
import { handleRefreshAPI } from "./api";
import { REFRESH_API_PATH } from "./constants";

// For Express
export default class SessionRecipe extends RecipeModule {
    private static instance: SessionRecipe | undefined = undefined;
    static RECIPE_ID = "session";

    config: {
        accessTokenPath: string;
        refreshTokenPath: string;
        cookieDomain: string | undefined;
        cookieSecure: boolean;
        cookieSameSite: "strict" | "lax" | "none";
        sessionExpiredStatusCode: number;
        sessionRefreshFeature: {
            disableDefaultImplementation: boolean;
        };
        errorHandlers: NormalisedErrorHandlers;
    };

    handshakeInfo: HandshakeInfo | undefined = undefined;

    constructor(recipeId: string, appInfo: NormalisedAppinfo, config?: TypeInput) {
        super(recipeId, appInfo);
        let normalisedInput: TypeNormalisedInput = validateAndNormaliseUserInput(this, config);

        this.config = {
            accessTokenPath: normalisedInput.accessTokenPath,
            refreshTokenPath: appInfo.apiBasePath + normaliseURLPathOrThrowError(this.getRecipeId(), REFRESH_API_PATH),
            cookieDomain: normalisedInput.cookieDomain,
            cookieSecure: normalisedInput.cookieSecure,
            cookieSameSite: normalisedInput.cookieSameSite,
            sessionExpiredStatusCode: normalisedInput.sessionExpiredStatusCode,
            sessionRefreshFeature: normalisedInput.sessionRefreshFeature,
            errorHandlers: normalisedInput.errorHandlers,
        };

        // Solving the cold start problem
        this.getHandshakeInfo().catch((ignored) => {
            // ignored
        });
    }

    static getInstanceOrThrowError(): SessionRecipe {
        if (SessionRecipe.instance !== undefined) {
            return SessionRecipe.instance;
        }
        throw new STError(
            {
                type: STError.GENERAL_ERROR,
                payload: new Error("Initialisation not done. Did you forget to call the SuperTokens.init function?"),
            },
            SessionRecipe.RECIPE_ID
        );
    }

    static init(config?: TypeInput): RecipeListFunction {
        return (appInfo) => {
            if (SessionRecipe.instance === undefined) {
                SessionRecipe.instance = new SessionRecipe("session", appInfo, config);
                return SessionRecipe.instance;
            } else {
                throw new STError(
                    {
                        type: STError.GENERAL_ERROR,
                        payload: new Error(
                            "Session recipe has already been initialised. Please check your code for bugs."
                        ),
                    },
                    SessionRecipe.RECIPE_ID
                );
            }
        };
    }

    static reset() {
        if (process.env.TEST_MODE !== "testing") {
            throw new STError(
                {
                    type: STError.GENERAL_ERROR,
                    payload: new Error("calling testing function in non testing env"),
                },
                SessionRecipe.RECIPE_ID
            );
        }
        SessionRecipe.instance = undefined;
    }

    // abstract instance functions below...............

    getAPIsHandled = (): APIHandled[] => {
        return [
            {
                method: "post",
                pathWithoutApiBasePath: REFRESH_API_PATH,
                id: "REFRESH",
                disabled: this.config.sessionRefreshFeature.disableDefaultImplementation,
            },
        ];
    };

    handleAPIRequest = (id: string, req: express.Request, res: express.Response, next: express.NextFunction) => {
        handleRefreshAPI(this, req, res, next);
    };

    handleError = (err: STError, request: express.Request, response: express.Response, next: express.NextFunction) => {
        if (err.type === STError.UNAUTHORISED) {
            return this.config.errorHandlers.onUnauthorised(err.message, request, response, next);
        } else if (err.type === STError.TRY_REFRESH_TOKEN) {
            return this.config.errorHandlers.onTryRefreshToken(err.message, request, response, next);
        } else {
            return this.config.errorHandlers.onTokenTheftDetected(
                err.payload.sessionHandle,
                err.payload.userId,
                request,
                response,
                next
            );
        }
    };

    getAllCORSHeaders = (): string[] => {
        return getCORSAllowedHeadersFromCookiesAndHeaders();
    };

    // instance functions below...............

    getHandshakeInfo = async (): Promise<HandshakeInfo> => {
        if (this.handshakeInfo == undefined) {
            let response = await this.getQuerier().sendPostRequest("/handshake", {});
            this.handshakeInfo = {
                jwtSigningPublicKey: response.jwtSigningPublicKey,
                enableAntiCsrf: response.enableAntiCsrf,
                accessTokenBlacklistingEnabled: response.accessTokenBlacklistingEnabled,
                jwtSigningPublicKeyExpiryTime: response.jwtSigningPublicKeyExpiryTime,
                accessTokenVaildity: response.accessTokenVaildity,
                refreshTokenVaildity: response.refreshTokenVaildity,
            };
        }
        return this.handshakeInfo;
    };

    updateJwtSigningPublicKeyInfo = (newKey: string, newExpiry: number) => {
        if (this.handshakeInfo !== undefined) {
            this.handshakeInfo.jwtSigningPublicKey = newKey;
            this.handshakeInfo.jwtSigningPublicKeyExpiryTime = newExpiry;
        }
    };

    createNewSession = async (
        res: express.Response,
        userId: string,
        jwtPayload: any = {},
        sessionData: any = {}
    ): Promise<Session> => {
        let response = await SessionFunctions.createNewSession(this, userId, jwtPayload, sessionData);
        attachCreateOrRefreshSessionResponseToExpressRes(this, res, response);
        return new Session(
            this,
            response.accessToken.token,
            response.session.handle,
            response.session.userId,
            response.session.userDataInJWT,
            response.accessToken.expiry,
            res
        );
    };

    getSession = async (req: express.Request, res: express.Response, doAntiCsrfCheck: boolean): Promise<Session> => {
        let idRefreshToken = getIdRefreshTokenFromCookie(req);
        if (idRefreshToken === undefined) {
            // we do not clear cookies here because of a
            // race condition mentioned here: https://github.com/supertokens/supertokens-node/issues/17

            throw new STError(
                {
                    message: "Session does not exist. Are you sending the session tokens in the request as cookies?",
                    type: STError.UNAUTHORISED,
                },
                this.getRecipeId()
            );
        }
        let accessToken = getAccessTokenFromCookie(req);
        if (accessToken === undefined) {
            // maybe the access token has expired.
            throw new STError(
                {
                    message: "Access token has expired. Please call the refresh API",
                    type: STError.TRY_REFRESH_TOKEN,
                },
                this.getRecipeId()
            );
        }
        try {
            let antiCsrfToken = getAntiCsrfTokenFromHeaders(req);
            let response = await SessionFunctions.getSession(this, accessToken, antiCsrfToken, doAntiCsrfCheck);
            if (response.accessToken !== undefined) {
                setFrontTokenInHeaders(
                    this,
                    res,
                    response.session.userId,
                    response.accessToken.expiry,
                    response.session.userDataInJWT
                );
                attachAccessTokenToCookie(this, res, response.accessToken.token, response.accessToken.expiry);
                accessToken = response.accessToken.token;
            }
            return new Session(
                this,
                accessToken,
                response.session.handle,
                response.session.userId,
                response.session.userDataInJWT,
                response.accessToken !== undefined ? response.accessToken.expiry : undefined,
                res
            );
        } catch (err) {
            if (err.type === STError.UNAUTHORISED) {
                clearSessionFromCookie(this, res);
            }
            throw err;
        }
    };

    refreshSession = async (req: express.Request, res: express.Response): Promise<Session> => {
        let inputRefreshToken = getRefreshTokenFromCookie(req);
        if (inputRefreshToken === undefined) {
            // we do not clear cookies here because of a
            // race condition mentioned here: https://github.com/supertokens/supertokens-node/issues/17

            throw new STError(
                {
                    message: "Refresh token not found. Are you sending the refresh token in the request as a cookie?",
                    type: STError.UNAUTHORISED,
                },
                this.getRecipeId()
            );
        }

        try {
            let antiCsrfToken = getAntiCsrfTokenFromHeaders(req);
            let response = await SessionFunctions.refreshSession(this, inputRefreshToken, antiCsrfToken);
            attachCreateOrRefreshSessionResponseToExpressRes(this, res, response);
            return new Session(
                this,
                response.accessToken.token,
                response.session.handle,
                response.session.userId,
                response.session.userDataInJWT,
                response.accessToken.expiry,
                res
            );
        } catch (err) {
            if (err.type === STError.UNAUTHORISED || err.type === STError.TOKEN_THEFT_DETECTED) {
                clearSessionFromCookie(this, res);
            }
            throw err;
        }
    };

    revokeAllSessionsForUser = (userId: string) => {
        return SessionFunctions.revokeAllSessionsForUser(this, userId);
    };

    getAllSessionHandlesForUser = (userId: string): Promise<string[]> => {
        return SessionFunctions.getAllSessionHandlesForUser(this, userId);
    };

    revokeSession = (sessionHandle: string): Promise<boolean> => {
        return SessionFunctions.revokeSession(this, sessionHandle);
    };

    revokeMultipleSessions = (sessionHandles: string[]) => {
        return SessionFunctions.revokeMultipleSessions(this, sessionHandles);
    };

    getSessionData = (sessionHandle: string): Promise<any> => {
        return SessionFunctions.getSessionData(this, sessionHandle);
    };

    updateSessionData = (sessionHandle: string, newSessionData: any) => {
        return SessionFunctions.updateSessionData(this, sessionHandle, newSessionData);
    };

    getJWTPayload = (sessionHandle: string): Promise<any> => {
        return SessionFunctions.getJWTPayload(this, sessionHandle);
    };

    updateJWTPayload = (sessionHandle: string, newJWTPayload: any) => {
        return SessionFunctions.updateJWTPayload(this, sessionHandle, newJWTPayload);
    };
}