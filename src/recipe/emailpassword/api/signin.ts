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

import { makeDefaultUserContextFromAPI, send200Response } from '../../../utils'
import { APIInterface, APIOptions } from '../'
import { validateFormFieldsOrThrowError } from './utils'

export default async function signInAPI(apiImplementation: APIInterface, options: APIOptions): Promise<boolean> {
  // Logic as per https://github.com/supertokens/supertokens-node/issues/20#issuecomment-710346362
  if (apiImplementation.signInPOST === undefined)
    return false

  // step 1
  const formFields: {
    id: string
    value: string
  }[] = await validateFormFieldsOrThrowError(
    options.config.signInFeature.formFields,
    (await options.req.getJSONBody()).formFields,
  )

  const result = await apiImplementation.signInPOST({
    formFields,
    options,
    userContext: makeDefaultUserContextFromAPI(options.req),
  })

  if (result.status === 'OK') {
    send200Response(options.res, {
      status: 'OK',
      user: result.user,
    })
  }
  else {
    send200Response(options.res, result)
  }
  return true
}