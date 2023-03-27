/* Copyright (c) 2021, VRAI Labs and/or its affiliates. All rights reserved.
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

import assert from 'assert'
import SuperTokens from 'supertokens-node'
import ProcessState from 'supertokens-node/processState'
import Session from 'supertokens-node/recipe/session'
import EmailPassword from 'supertokens-node/recipe/emailpassword'
import axios from 'axios'
import Dashboard from 'supertokens-node/recipe/dashboard'
import { afterEach, beforeEach, describe, it } from 'vitest'
import { RestApplication } from '@loopback/rest'
import { cleanST, extractInfoFromResponse, killAllST, printPath, setupST, startST } from '../utils'
import { app } from './loopback-server'
describe(`Loopback: ${printPath('[test/framework/loopback.test.js]')}`, () => {
  let server: RestApplication
  beforeEach(async () => {
    await killAllST()
    await setupST()
    ProcessState.getInstance().reset()
    server = app
  })

  afterEach(async () => {
    if (server !== undefined)
      await server.stop()
  })

  afterEach(async () => {
    await killAllST()
    await cleanST()
  })

  // check basic usage of session
  it('test basic usage of sessions', async () => {
    await startST()
    SuperTokens.init({
      framework: 'loopback',
      supertokens: {
        connectionURI: 'http://localhost:8080',
      },
      appInfo: {
        apiDomain: 'api.supertokens.io',
        appName: 'SuperTokens',
        websiteDomain: 'supertokens.io',
      },
      recipeList: [Session.init({ getTokenTransferMethod: () => 'cookie', antiCsrf: 'VIA_TOKEN' })],
    })

    await server.start()

    let result = await axios({
      url: '/create',
      baseURL: 'http://localhost:9876',
      method: 'post',
    })
    const res = extractInfoFromResponse(result)

    assert(res.accessToken !== undefined)
    assert(res.antiCsrf !== undefined)
    assert(res.refreshToken !== undefined)

    try {
      await axios({
        url: '/session/verify',
        baseURL: 'http://localhost:9876',
        method: 'post',
      })
    }
    catch (err) {
      if (err !== undefined && err.response !== undefined) {
        assert.strictEqual(err.response.status, 401)
        assert.deepStrictEqual(err.response.data, { message: 'unauthorised' })
      }
      else {
        throw err
      }
    }

    try {
      await axios({
        url: '/session/verify',
        baseURL: 'http://localhost:9876',
        method: 'post',
        headers: {
          Cookie: `sAccessToken=${res.accessToken}`,
        },
      })
    }
    catch (err) {
      if (err !== undefined && err.response !== undefined) {
        assert.strictEqual(err.response.status, 401)
        assert.deepStrictEqual(err.response.data, { message: 'try refresh token' })
      }
      else {
        throw err
      }
    }

    result = await axios({
      url: '/session/verify',
      baseURL: 'http://localhost:9876',
      method: 'post',
      headers: {
        'Cookie': `sAccessToken=${res.accessToken}`,
        'anti-csrf': res.antiCsrf,
      },
    })
    assert.deepStrictEqual(result.data, { user: 'userId' })

    result = await axios({
      url: '/session/verify/optionalCSRF',
      baseURL: 'http://localhost:9876',
      method: 'post',
      headers: {
        Cookie: `sAccessToken=${res.accessToken}`,
      },
    })
    assert.deepStrictEqual(result.data, { user: 'userId' })

    try {
      await axios({
        url: '/auth/session/refresh',
        baseURL: 'http://localhost:9876',
        method: 'post',
      })
    }
    catch (err) {
      if (err !== undefined && err.response !== undefined) {
        assert.strictEqual(err.response.status, 401)
        assert.deepStrictEqual(err.response.data, { message: 'unauthorised' })
      }
      else {
        throw err
      }
    }

    result = await axios({
      url: '/auth/session/refresh',
      baseURL: 'http://localhost:9876',
      method: 'post',
      headers: {
        'Cookie': `sRefreshToken=${res.refreshToken}`,
        'anti-csrf': res.antiCsrf,
      },
    })

    const res2 = extractInfoFromResponse(result)

    assert(res2.accessToken !== undefined)
    assert(res2.antiCsrf !== undefined)
    assert(res2.refreshToken !== undefined)

    result = await axios({
      url: '/session/verify',
      baseURL: 'http://localhost:9876',
      method: 'post',
      headers: {
        'Cookie': `sAccessToken=${res2.accessToken}`,
        'anti-csrf': res2.antiCsrf,
      },
    })
    assert.deepStrictEqual(result.data, { user: 'userId' })

    const res3 = extractInfoFromResponse(result)
    assert(res3.accessToken !== undefined)

    result = await axios({
      url: '/session/revoke',
      baseURL: 'http://localhost:9876',
      method: 'post',
      headers: {
        'Cookie': `sAccessToken=${res3.accessToken}`,
        'anti-csrf': res2.antiCsrf,
      },
    })

    const sessionRevokedResponseExtracted = extractInfoFromResponse(result)
    assert(sessionRevokedResponseExtracted.accessTokenExpiry === 'Thu, 01 Jan 1970 00:00:00 GMT')
    assert(sessionRevokedResponseExtracted.refreshTokenExpiry === 'Thu, 01 Jan 1970 00:00:00 GMT')
    assert(sessionRevokedResponseExtracted.accessToken === '')
    assert(sessionRevokedResponseExtracted.refreshToken === '')
  })

  it('sending custom response', async () => {
    await startST()
    SuperTokens.init({
      framework: 'loopback',
      supertokens: {
        connectionURI: 'http://localhost:8080',
      },
      appInfo: {
        apiDomain: 'api.supertokens.io',
        appName: 'SuperTokens',
        websiteDomain: 'supertokens.io',
      },
      recipeList: [
        EmailPassword.init({
          override: {
            apis: (oI) => {
              return {
                ...oI,
                async emailExistsGET(input) {
                  input.options.res.setStatusCode(203)
                  input.options.res.sendJSONResponse({
                    custom: true,
                  })
                  return oI.emailExistsGET(input)
                },
              }
            },
          },
        }),
        Session.init({ getTokenTransferMethod: () => 'cookie' }),
      ],
    })

    await server.start()

    const result = await axios({
      url: '/auth/signup/email/exists?email=test@example.com',
      baseURL: 'http://localhost:9876',
      method: 'get',
    })
    await new Promise(r => setTimeout(r, 1000)) // we delay so that the API call finishes and doesn't shut the core before the test finishes.
    assert(result.status === 203)
    assert(result.data.custom)
  })

  it('test that authorization header is read correctly in dashboard recipe', async () => {
    await startST()
    SuperTokens.init({
      framework: 'loopback',
      supertokens: {
        connectionURI: 'http://localhost:8080',
      },
      appInfo: {
        apiDomain: 'api.supertokens.io',
        appName: 'SuperTokens',
        websiteDomain: 'supertokens.io',
      },
      recipeList: [
        Dashboard.init({
          apiKey: 'testapikey',
          override: {
            functions: (original) => {
              return {
                ...original,
                async shouldAllowAccess(input) {
                  const authHeader = input.req.getHeaderValue('authorization')
                  if (authHeader === 'Bearer testapikey')
                    return true

                  return false
                },
              }
            },
          },
        }),
      ],
    })

    await server.start()

    const result = await axios({
      url: '/auth/dashboard/api/users/count',
      baseURL: 'http://localhost:9876',
      method: 'get',
      headers: {
        'Authorization': 'Bearer testapikey',
        'Content-Type': 'application/json',
      },
    })

    assert(result.status === 200)
  })
})
