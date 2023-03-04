/* Copyright (c) 2022, VRAI Labs and/or its affiliates. All rights reserved.
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

import OverrideableBuilder from 'supertokens-js-override'
import { BaseRequest } from '../../framework/request'
import { BaseResponse } from '../../framework/response'
import { NormalisedAppinfo } from '../../types'

export interface TypeInput {
  apiKey?: string
  override?: {
    functions?: (
      originalImplementation: RecipeInterface,
      builder?: OverrideableBuilder<RecipeInterface>
    ) => RecipeInterface
    apis?: (originalImplementation: APIInterface, builder?: OverrideableBuilder<APIInterface>) => APIInterface
  }
}

export interface TypeNormalisedInput {
  apiKey?: string
  authMode: AuthMode
  override: {
    functions: (
      originalImplementation: RecipeInterface,
      builder?: OverrideableBuilder<RecipeInterface>
    ) => RecipeInterface
    apis: (originalImplementation: APIInterface, builder?: OverrideableBuilder<APIInterface>) => APIInterface
  }
}

export interface RecipeInterface {
  getDashboardBundleLocation(input: { userContext: any }): Promise<string>
  shouldAllowAccess(input: { req: BaseRequest; config: TypeNormalisedInput; userContext: any }): Promise<boolean>
}

export interface APIOptions {
  recipeImplementation: RecipeInterface
  config: TypeNormalisedInput
  recipeId: string
  req: BaseRequest
  res: BaseResponse
  isInServerlessEnv: boolean
  appInfo: NormalisedAppinfo
}

export interface APIInterface {
  dashboardGET: undefined | ((input: { options: APIOptions; userContext: any }) => Promise<string>)
}

export type APIFunction = (apiImplementation: APIInterface, options: APIOptions) => Promise<any>

export type RecipeIdForUser = 'emailpassword' | 'thirdparty' | 'passwordless'

export type AuthMode = 'api-key' | 'email-password'

interface CommonUserInformation {
  id: string
  timeJoined: number
  firstName: string
  lastName: string
}

export type EmailPasswordUser = CommonUserInformation & {
  email: string
}

export type ThirdPartyUser = CommonUserInformation & {
  email: string
  thirdParty: {
    id: string
    userId: string
  }
}

export type PasswordlessUser = CommonUserInformation & {
  email?: string
  phone?: string
}
