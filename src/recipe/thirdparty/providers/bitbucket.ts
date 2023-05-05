/* Copyright (c) 2023, VRAI Labs and/or its affiliates. All rights reserved.
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

import axios from 'axios'
import { TypeProvider, TypeProviderGetResponse } from '../types'

interface TypeThirdPartyProviderBitbucketConfig {
  clientId: string
  clientSecret: string
  scope?: string[]
  authorisationRedirect?: {
    params?: { [key: string]: string | ((request: any) => string) }
  }
  isDefault?: boolean
}

export default function Bitbucket(config: TypeThirdPartyProviderBitbucketConfig): TypeProvider {
  const id = 'bitbucket'

  function get(redirectURI: string | undefined, authCodeFromRequest: string | undefined): TypeProviderGetResponse {
    const accessTokenAPIURL = 'https://bitbucket.org/site/oauth2/access_token'
    const accessTokenAPIParams: { [key: string]: string } = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
    }
    if (authCodeFromRequest !== undefined)
      accessTokenAPIParams.code = authCodeFromRequest

    if (redirectURI !== undefined)
      accessTokenAPIParams.redirect_uri = redirectURI

    const authorisationRedirectURL = 'https://bitbucket.org/site/oauth2/authorize'
    let scopes = ['account', 'email']
    if (config.scope !== undefined) {
      scopes = config.scope
      scopes = Array.from(new Set(scopes))
    }
    const additionalParams
            = (config.authorisationRedirect === undefined || config.authorisationRedirect.params === undefined)
              ? {}
              : config.authorisationRedirect.params
    const authorizationRedirectParams: { [key: string]: string } = {
      scope: scopes.join(' '),
      access_type: 'offline',
      response_type: 'code',
      client_id: config.clientId,
      ...additionalParams,
    }

    async function getProfileInfo(accessTokenAPIResponse: {
      access_token: string
      expires_in: number
      token_type: string
      refresh_token?: string
    }) {
      const accessToken = accessTokenAPIResponse.access_token
      const authHeader = `Bearer ${accessToken}`
      const response = await axios({
        method: 'get',
        url: 'https://api.bitbucket.org/2.0/user',
        headers: {
          Authorization: authHeader,
        },
      })
      const userInfo = response.data
      const id = userInfo.uuid

      const emailRes = await axios({
        method: 'get',
        url: 'https://api.bitbucket.org/2.0/user/emails',
        headers: {
          Authorization: authHeader,
        },
      })
      const emailData = emailRes.data
      let email
      let isVerified = false
      emailData.values.forEach((emailInfo: any) => {
        if (emailInfo.is_primary) {
          email = emailInfo.email
          isVerified = emailInfo.is_confirmed
        }
      })

      if (email === undefined) {
        return {
          id,
        }
      }
      return {
        id,
        email: {
          id: email,
          isVerified,
        },
      }
    }

    return {
      accessTokenAPI: {
        url: accessTokenAPIURL,
        params: accessTokenAPIParams,
      },
      authorisationRedirect: {
        url: authorisationRedirectURL,
        params: authorizationRedirectParams,
      },
      getProfileInfo,
      getClientId: () => {
        return config.clientId
      },
    }
  }

  return {
    id,
    get,
    isDefault: config.isDefault,
  }
}
