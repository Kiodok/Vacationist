package expo.modules.restorecredentials

import android.content.Context
import android.os.Build
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CreateRestoreCredentialRequest
import androidx.credentials.CreateRestoreCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetRestoreCredentialOption
import androidx.credentials.RestoreCredential
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.restorecredential.E2eeUnavailableException
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Phase 17 — Android Zero-Tap Sign-In. Thin bridge over Credential Manager's Restore Credentials
 * API (androidx.credentials 1.5.0+). The WebAuthn option/response JSON is produced and verified
 * by the `restore-credential` Edge Function; this module only shuttles the opaque JSON strings
 * to and from the platform.
 *
 * Android-only by design (expo-module.config.json declares only the android platform). On iOS
 * and web the JS side never loads this — `isSupported()` resolves false there.
 */
class ExpoRestoreCredentialsModule : Module() {
  private val scope = CoroutineScope(Dispatchers.Main)

  private val context: Context
    get() = appContext.currentActivity
      ?: appContext.reactContext
      ?: throw IllegalStateException("No Android context available")

  override fun definition() = ModuleDefinition {
    Name("ExpoRestoreCredentials")

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
    }

    // Creates the device-bound restore key. `registrationJson` is a WebAuthn
    // PublicKeyCredentialCreationOptionsJSON string; returns the registration response JSON to
    // hand back to the server for verification + public-key storage.
    AsyncFunction("createRestoreKey") { registrationJson: String, promise: Promise ->
      scope.launch {
        try {
          val credentialManager = CredentialManager.create(context)
          val response = try {
            credentialManager.createCredential(
              context,
              CreateRestoreCredentialRequest(registrationJson, isCloudBackupEnabled = true),
            ) as CreateRestoreCredentialResponse
          } catch (e: E2eeUnavailableException) {
            // Device has no backup / screen lock — fall back to a local-only key. It won't
            // survive a cloud restore, but it's better than no key at all.
            credentialManager.createCredential(
              context,
              CreateRestoreCredentialRequest(registrationJson, isCloudBackupEnabled = false),
            ) as CreateRestoreCredentialResponse
          }
          promise.resolve(response.responseJson)
        } catch (e: Exception) {
          promise.reject("ERR_RESTORE_CREATE", e.message ?: "createRestoreKey failed", e)
        }
      }
    }

    // Attempts to retrieve the restore key on a new device. `authenticationJson` is a WebAuthn
    // PublicKeyCredentialRequestOptionsJSON string. Resolves the assertion response JSON, or
    // null when there is no credential to restore / the user dismissed the prompt.
    AsyncFunction("getRestoreKey") { authenticationJson: String, promise: Promise ->
      scope.launch {
        try {
          val credentialManager = CredentialManager.create(context)
          val result = credentialManager.getCredential(
            context,
            GetCredentialRequest(listOf(GetRestoreCredentialOption(authenticationJson))),
          )
          val credential = result.credential
          if (credential is RestoreCredential) {
            promise.resolve(credential.authenticationResponseJson)
          } else {
            promise.resolve(null)
          }
        } catch (e: GetCredentialException) {
          // No credential available / cancelled — not an error, just "can't restore".
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_RESTORE_GET", e.message ?: "getRestoreKey failed", e)
        }
      }
    }

    // Deletes the restore key from the device and its cloud backup. Called on sign-out.
    AsyncFunction("clearRestoreKey") { promise: Promise ->
      scope.launch {
        try {
          CredentialManager.create(context).clearCredentialState(
            ClearCredentialStateRequest(ClearCredentialStateRequest.TYPE_CLEAR_RESTORE_CREDENTIAL),
          )
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_RESTORE_CLEAR", e.message ?: "clearRestoreKey failed", e)
        }
      }
    }
  }
}
