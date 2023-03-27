import assert from 'assert'
import STExpress from 'supertokens-node'
import { ProcessState } from 'supertokens-node/processState'
import UserMetadataRecipe from 'supertokens-node/recipe/usermetadata'
import { Querier } from 'supertokens-node/querier'
import { maxVersion } from 'supertokens-node/utils'
import { afterAll, beforeEach, describe, it } from 'vitest'
import { cleanST, killAllST, printPath, setupST, startST } from '../utils'

describe(`updateUserMetadataTest: ${printPath('[test/usermetadata/updateUserMetadata.test.js]')}`, () => {
  beforeEach(async () => {
    await killAllST()
    await setupST()
    ProcessState.getInstance().reset()
  })

  afterAll(async () => {
    await killAllST()
    await cleanST()
  })

  describe('updateUserMetadata', () => {
    it('should create metadata for unknown user id', async function () {
      await startST()

      const testUserId = 'userId'
      const testMetadata = {
        role: 'admin',
      }

      STExpress.init({
        supertokens: {
          connectionURI: 'http://localhost:8080',
        },
        appInfo: {
          apiDomain: 'api.supertokens.io',
          appName: 'SuperTokens',
          websiteDomain: 'supertokens.io',
        },
        recipeList: [UserMetadataRecipe.init()],
      })

      // Only run for version >= 2.13
      const querier = Querier.getNewInstanceOrThrowError(undefined)
      const apiVersion = await querier.getAPIVersion()
      if (maxVersion(apiVersion, '2.12') === '2.12')
        return this.skip()

      const updateResult = await UserMetadataRecipe.updateUserMetadata(testUserId, testMetadata)

      const getResult = await UserMetadataRecipe.getUserMetadata(testUserId)

      assert.strictEqual(updateResult.status, 'OK')
      assert.deepStrictEqual(updateResult.metadata, testMetadata)
      assert.strictEqual(getResult.status, 'OK')
      assert.deepStrictEqual(getResult.metadata, testMetadata)
    })

    it('should create metadata with utf8 encoding', async function () {
      await startST()

      const testUserId = 'userId'
      const testMetadata = {
        role: '\uFDFD   Æää',
      }

      STExpress.init({
        supertokens: {
          connectionURI: 'http://localhost:8080',
        },
        appInfo: {
          apiDomain: 'api.supertokens.io',
          appName: 'SuperTokens',
          websiteDomain: 'supertokens.io',
        },
        recipeList: [UserMetadataRecipe.init()],
      })

      // Only run for version >= 2.13
      const querier = Querier.getNewInstanceOrThrowError(undefined)
      const apiVersion = await querier.getAPIVersion()
      if (maxVersion(apiVersion, '2.12') === '2.12')
        return this.skip()

      const updateResult = await UserMetadataRecipe.updateUserMetadata(testUserId, testMetadata)

      const getResult = await UserMetadataRecipe.getUserMetadata(testUserId)

      assert.strictEqual(updateResult.status, 'OK')
      assert.deepStrictEqual(updateResult.metadata, testMetadata)
      assert.strictEqual(getResult.status, 'OK')
      assert.deepStrictEqual(getResult.metadata, testMetadata)
    })

    it('should create metadata for cleared user id', async function () {
      await startST()

      const testUserId = 'userId'
      const testMetadata = {
        role: 'admin',
      }

      STExpress.init({
        supertokens: {
          connectionURI: 'http://localhost:8080',
        },
        appInfo: {
          apiDomain: 'api.supertokens.io',
          appName: 'SuperTokens',
          websiteDomain: 'supertokens.io',
        },
        recipeList: [UserMetadataRecipe.init()],
      })

      // Only run for version >= 2.13
      const querier = Querier.getNewInstanceOrThrowError(undefined)
      const apiVersion = await querier.getAPIVersion()
      if (maxVersion(apiVersion, '2.12') === '2.12')
        return this.skip()

      await UserMetadataRecipe.updateUserMetadata(testUserId, { test: 'asdf' })
      await UserMetadataRecipe.clearUserMetadata(testUserId)
      const updateResult = await UserMetadataRecipe.updateUserMetadata(testUserId, testMetadata)

      const getResult = await UserMetadataRecipe.getUserMetadata(testUserId)

      assert.strictEqual(updateResult.status, 'OK')
      assert.deepStrictEqual(updateResult.metadata, testMetadata)

      assert.strictEqual(getResult.status, 'OK')
      assert.deepStrictEqual(getResult.metadata, testMetadata)
    })

    it('should update metadata by shallow merge', async function () {
      await startST()

      const testUserId = 'userId'
      const testMetadata = {
        updated: {
          subObjectNull: 'this will become null',
          subObjectCleared: 'this will be removed',
          subObjectUpdate: 'this will become a number',
        },
        cleared: 'this should not be on the end result',
      }
      const testMetadataUpdate = {
        updated: {
          subObjectNull: null,
          subObjectUpdate: 123,
          subObjectNewProp: 'this will appear',
        },
        cleared: null,
        newRootProp: 'this should appear on the end result',
      }
      const expectedResult = {
        updated: {
          subObjectNull: null,
          subObjectUpdate: 123,
          subObjectNewProp: 'this will appear',
        },
        newRootProp: 'this should appear on the end result',
      }

      STExpress.init({
        supertokens: {
          connectionURI: 'http://localhost:8080',
        },
        appInfo: {
          apiDomain: 'api.supertokens.io',
          appName: 'SuperTokens',
          websiteDomain: 'supertokens.io',
        },
        recipeList: [UserMetadataRecipe.init()],
      })

      // Only run for version >= 2.13
      const querier = Querier.getNewInstanceOrThrowError(undefined)
      const apiVersion = await querier.getAPIVersion()
      if (maxVersion(apiVersion, '2.12') === '2.12')
        return this.skip()

      await UserMetadataRecipe.updateUserMetadata(testUserId, testMetadata)
      const updateResult = await UserMetadataRecipe.updateUserMetadata(testUserId, testMetadataUpdate)

      const getResult = await UserMetadataRecipe.getUserMetadata(testUserId)

      assert.strictEqual(updateResult.status, 'OK')
      assert.deepStrictEqual(updateResult.metadata, expectedResult)

      assert.strictEqual(getResult.status, 'OK')
      assert.deepStrictEqual(getResult.metadata, expectedResult)
    })
  })
})
