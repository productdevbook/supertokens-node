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
import { Querier } from 'supertokens-node/querier'
import EmailPassword from 'supertokens-node/recipe/emailpassword'
import express from 'express'
import request from 'supertest'
import { errorHandler, middleware } from 'supertokens-node/framework/express'
import { maxVersion } from 'supertokens-node/utils'
import { afterAll, beforeEach, describe, it } from 'vitest'
import { cleanST, killAllST, printPath, setupST, signUPRequest, startST } from '../utils'

/**
 * TODO: (later) in passwordResetFunctions.ts:
 *        - (later) check that createAndSendCustomEmail works fine
 * TODO: generate token API:
 *        - (later) Call the createResetPasswordToken function with valid input
 *        - (later) Call the createResetPasswordToken with unknown userId and test error thrown
 * TODO: password reset API:
 *        - (later) Call the resetPasswordUsingToken function with valid input
 *        - (later) Call the resetPasswordUsingToken with an invalid token and see the error
 *        - (later) token is not of type string from input
 */

describe(`passwordreset: ${printPath('[test/emailpassword/passwordreset.test.js]')}`, () => {
  beforeEach(async () => {
    await killAllST()
    await setupST()
    ProcessState.getInstance().reset()
  })

  afterAll(async () => {
    await killAllST()
    await cleanST()
  })

  /*
     * generate token API:
     *      - email validation checks
     *      - non existent email should return "OK" with a pause > 300MS
     *      - check that the generated password reset link is correct
     */
  it('test email validation checks in generate token API', async () => {
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
      recipeList: [EmailPassword.init()],
    })
    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const response = await new Promise(resolve =>
      request(app)
        .post('/auth/user/password/reset/token')
        .send({
          formFields: [
            {
              id: 'email',
              value: 'random',
            },
          ],
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(res)
        }),
    )
    assert(response.body.status === 'FIELD_ERROR')
    assert(response.body.formFields.length === 1)
    assert(response.body.formFields[0].error === 'Email is invalid')
    assert(response.body.formFields[0].id === 'email')
  })

  it('test that generated password link is correct', async () => {
    await startST()

    let resetURL = ''
    let tokenInfo = ''
    let ridInfo = ''
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
        EmailPassword.init({
          resetPasswordUsingTokenFeature: {
            createAndSendCustomEmail: (user, passwordResetURLWithToken) => {
              resetURL = passwordResetURLWithToken.split('?')[0]
              tokenInfo = passwordResetURLWithToken.split('?')[1].split('&')[0]
              ridInfo = passwordResetURLWithToken.split('?')[1].split('&')[1]
            },
          },
        }),
        Session.init({ getTokenTransferMethod: () => 'cookie' }),
      ],
    })
    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const response = await signUPRequest(app, 'random@gmail.com', 'validpass123')
    assert(JSON.parse(response.text).status === 'OK')
    assert(response.status === 200)

    await new Promise(resolve =>
      request(app)
        .post('/auth/user/password/reset/token')
        .send({
          formFields: [
            {
              id: 'email',
              value: 'random@gmail.com',
            },
          ],
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(res)
        }),
    )
    assert(resetURL === 'https://supertokens.io/auth/reset-password')
    assert(tokenInfo.startsWith('token='))
    assert(ridInfo.startsWith('rid=emailpassword'))
  })

  /*
     * password reset API:
     *        - password validation checks
     *        - token is missing from input
     *        - invalid token in input
     *        - input is valid, check that password has changed (call sign in)
     */
  it('test password validation', async () => {
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
      recipeList: [EmailPassword.init()],
    })
    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    let response = await new Promise(resolve =>
      request(app)
        .post('/auth/user/password/reset')
        .send({
          formFields: [
            {
              id: 'password',
              value: 'invalid',
            },
          ],
          token: 'randomToken',
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )
    assert(response.status === 'FIELD_ERROR')
    assert(response.formFields[0].error === 'Password must contain at least 8 characters, including a number')
    assert(response.formFields[0].id === 'password')

    response = await new Promise(resolve =>
      request(app)
        .post('/auth/user/password/reset')
        .send({
          formFields: [
            {
              id: 'password',
              value: 'validpass123',
            },
          ],
          token: 'randomToken',
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )
    assert(response.status !== 'FIELD_ERROR')
  })

  it('test token missing from input', async () => {
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
      recipeList: [EmailPassword.init()],
    })
    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const response = await new Promise(resolve =>
      request(app)
        .post('/auth/user/password/reset')
        .send({
          formFields: [
            {
              id: 'password',
              value: 'validpass123',
            },
          ],
        })
        .expect(400)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )
    assert(response.message === 'Please provide the password reset token')
  })

  it('test invalid token input', async () => {
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
      recipeList: [EmailPassword.init()],
    })
    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const response = await new Promise(resolve =>
      request(app)
        .post('/auth/user/password/reset')
        .send({
          formFields: [
            {
              id: 'password',
              value: 'validpass123',
            },
          ],
          token: 'invalidToken',
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )
    assert(response.status === 'RESET_PASSWORD_INVALID_TOKEN_ERROR')
  })

  it('test valid token input and passoword has changed', async () => {
    await startST()

    let passwordResetUserId
    let token = ''
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
        EmailPassword.init({
          override: {
            apis: (oI) => {
              return {
                ...oI,
                async passwordResetPOST(input) {
                  const resp = await oI.passwordResetPOST(input)
                  if (resp.userId !== undefined)
                    passwordResetUserId = resp.userId

                  return resp
                },
              }
            },
          },
          resetPasswordUsingTokenFeature: {
            createAndSendCustomEmail: (user, passwordResetURLWithToken) => {
              token = passwordResetURLWithToken.split('?')[1].split('&')[0].split('=')[1]
            },
          },
        }),
        Session.init({ getTokenTransferMethod: () => 'cookie' }),
      ],
    })

    const app = express()

    app.use(middleware())

    app.use(errorHandler())

    const response = await signUPRequest(app, 'random@gmail.com', 'validpass123')
    assert(JSON.parse(response.text).status === 'OK')
    assert(response.status === 200)

    const userInfo = JSON.parse(response.text).user

    await new Promise(resolve =>
      request(app)
        .post('/auth/user/password/reset/token')
        .send({
          formFields: [
            {
              id: 'email',
              value: 'random@gmail.com',
            },
          ],
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(res)
        }),
    )

    await new Promise(resolve =>
      request(app)
        .post('/auth/user/password/reset')
        .send({
          formFields: [
            {
              id: 'password',
              value: 'validpass12345',
            },
          ],
          token,
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )

    const currCDIVersion = await Querier.getNewInstanceOrThrowError(undefined).getAPIVersion()
    if (maxVersion(currCDIVersion, '2.12') === currCDIVersion)
      assert(passwordResetUserId !== undefined && passwordResetUserId === userInfo.id)

    else
      assert(passwordResetUserId === undefined)

    const failureResponse = await new Promise(resolve =>
      request(app)
        .post('/auth/signin')
        .send({
          formFields: [
            {
              id: 'password',
              value: 'validpass123',
            },
            {
              id: 'email',
              value: 'random@gmail.com',
            },
          ],
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)
          else
            resolve(JSON.parse(res.text))
        }),
    )
    assert(failureResponse.status === 'WRONG_CREDENTIALS_ERROR')

    const successResponse = await new Promise(resolve =>
      request(app)
        .post('/auth/signin')
        .send({
          formFields: [
            {
              id: 'password',
              value: 'validpass12345',
            },
            {
              id: 'email',
              value: 'random@gmail.com',
            },
          ],
        })
        .expect(200)
        .end((err, res) => {
          if (err)
            resolve(undefined)

          else
            resolve(JSON.parse(res.text))
        }),
    )
    assert(successResponse.status === 'OK')
    assert(successResponse.user.id === userInfo.id)
    assert(successResponse.user.email === userInfo.email)
  })
})
