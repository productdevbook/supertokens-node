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
import STExpress from 'supertokens-node'

import Session from 'supertokens-node/recipe/session'
import { ProcessState } from 'supertokens-node/processState'
import ThirdPartyEmailPassword from 'supertokens-node/recipe/thirdpartyemailpassword'
import request from 'supertest'
import express from 'express'
import { errorHandler, middleware } from 'supertokens-node/framework/express'
import { afterAll, beforeEach, describe, it } from 'vitest'
import { cleanST, killAllST, printPath, setupST, signUPRequest, startST } from '../utils'

describe(`emailExists: ${printPath('[test/thirdpartyemailpassword/emailExists.test.js]')}`, () => {
  beforeEach(async () => {
    await killAllST()
    await setupST()
    ProcessState.getInstance().reset()
  })

  afterAll(async () => {
    await killAllST()
    await cleanST()
  })

  // disable the email exists API, and check that calling it returns a 404.
  it('test that if disable api, the default email exists API does not work', async () => {
    await startST()
    STExpress.init({
      supertokens: {
        connectionURI: 'http://localhost:8080',
      },
      appInfo: {
        apiDomain: 'api.supertokens.io',
        appName: 'SuperTokens',
        websiteDomain: 'supertokens.io',
      },
      recipeList: [
        ThirdPartyEmailPassword.init({
          override: {
            apis: (oI) => {
              return {
                ...oI,
                emailPasswordEmailExistsGET: undefined,
              }
            },
          },
        }),
        Session.init({ getTokenTransferMethod: () => 'cookie' }),
      ],
    })

    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const response = await new Promise(resolve =>
      request(app)
        .get('/auth/signup/email/exists')
        .query({
          email: 'random@gmail.com',
        })
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(res)
        }),
    )

    assert(response.status === 404)
  })

  // email exists
  it('test good input, email exists', async () => {
    await startST()
    STExpress.init({
      supertokens: {
        connectionURI: 'http://localhost:8080',
      },
      appInfo: {
        apiDomain: 'api.supertokens.io',
        appName: 'SuperTokens',
        websiteDomain: 'supertokens.io',
      },
      recipeList: [ThirdPartyEmailPassword.init(), Session.init({ getTokenTransferMethod: () => 'cookie' })],
    })

    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const signUpResponse = await signUPRequest(app, 'random@gmail.com', 'validPass123')
    assert(signUpResponse.status === 200)
    assert(JSON.parse(signUpResponse.text).status === 'OK')

    const response = await new Promise(resolve =>
      request(app)
        .get('/auth/signup/email/exists')
        .query({
          email: 'random@gmail.com',
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )

    assert(Object.keys(response).length === 2)
    assert(response.status === 'OK')
    assert(response.exists === true)
  })

  // email does not exist
  it('test good input, email does not exists', async () => {
    await startST()
    STExpress.init({
      supertokens: {
        connectionURI: 'http://localhost:8080',
      },
      appInfo: {
        apiDomain: 'api.supertokens.io',
        appName: 'SuperTokens',
        websiteDomain: 'supertokens.io',
      },
      recipeList: [ThirdPartyEmailPassword.init(), Session.init({ getTokenTransferMethod: () => 'cookie' })],
    })

    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const response = await new Promise(resolve =>
      request(app)
        .get('/auth/signup/email/exists')
        .query({
          email: 'random@gmail.com',
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )

    assert(Object.keys(response).length === 2)
    assert(response.status === 'OK')
    assert(response.exists === false)
  })

  // testing error is correctly handled by the sub-recipe
  it('test bad input, do not pass email', async () => {
    await startST()
    STExpress.init({
      supertokens: {
        connectionURI: 'http://localhost:8080',
      },
      appInfo: {
        apiDomain: 'api.supertokens.io',
        appName: 'SuperTokens',
        websiteDomain: 'supertokens.io',
      },
      recipeList: [ThirdPartyEmailPassword.init(), Session.init({ getTokenTransferMethod: () => 'cookie' })],
    })

    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const response = await new Promise(resolve =>
      request(app)
        .get('/auth/signup/email/exists')
        .query()
        .expect(400)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )
    assert(response.message === 'Please provide the email as a GET param')
  })
})
