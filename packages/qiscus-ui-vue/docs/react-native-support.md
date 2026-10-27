# React Native Support

## Requirement

Qiscus Chat SDK supports developers who want to use React Native. You can use it seamlessly without any native bridging. To do so, you need to first install the Web chat SDK. You can do that by going to your app project and type the command bellow:

```
$ npm install --save git://github.com/qiscus/qiscus-sdk-web-core.git
```

## Try Sample App

You can download the sample directly from our [github repository](https://github.com/qiscus/qiscus-rn-example), or if you already have Git installed, you can just clone it.

```
$ git clone https://github.com/qiscus/qiscus-rn-example
```

After cloning is completed, you will need React Native Command Line to run the sample app. In the example below, we use react-native-cli from nodejs package manager to serve Sample App locally.

```
# Install react-native-cli from npm globally
$ npm install react-native-cli -g # Choose folder and run Web SDK Sample
$ cd qiscus-rn-example
$ npm install
$ react-native run-android # Or run-ios if you prefer use iOS platform
```

If you want your sample app running with your own APP ID, you can change it inside the `config.js` which is located at App`/config.js`.

## Configuration

As we knew that Web Chat SDK is designed for web platform while React Native mainly for mobile purpose. To make Web Chat SDK works on React Native, we need to create a simple script preventing any conflict on the library. You can copy the code below and save it as `libs\QiscusSDKCore.js`.

```
/* eslint-disable */
import QiscusSDK from 'qiscus-sdk-core'

// this part is only for browsers, but we need to get around this part
// so that build tool not complaining
global.qiscus = null
export default (function QiscusStoreSingleton() {
  if (!global.qiscus) global.qiscus = new QiscusSDK()
  return global.qiscus
})()
```

To use it, you need to import SDK dependency in your code. Here is how to import the dependency:

```
import qiscus from './libs/QiscusSDKCore'
```

## Enable Push Notification

### Configuration

Push notification feature is not available by default, you need enable this by adding Firebase Cloud Messaging (FCM) library. You can do that by typing the command bellow:

```
$ npm install —save react-native-fcm
```

You also need to configure FCM by following this [Firebase steps](https://firebase.google.com/docs/cloud-messaging/android/client) and [react-native-fcm setup](https://github.com/evollu/react-native-fcm/tree/firebase#fcm-config-file). Next step is registering logged user with the device by request in our REST API endpoint `/api/v2/mobile/set_user_device_token`. You need to get FCM token first by doing like this:

```
let tokenType = null
await FCM.getFCMToken().then(tokenFCM => {
  if (tokenFCM !== null && tokenFCM !== undefined) {
    tokenType = tokenFCM
  }
})
```

Here is the complete example of how to put all together:

```
async successLogin (data) {
  let platform = 'rn'
  let tokenType = null
  FCM.requestPermissions({badge: false, sound: true, alert: true})

  await FCM.getFCMToken().then(tokenFCM => {
    if (tokenFCM !== null && tokenFCM !== undefined) {
      tokenType = tokenFCM
    }
  })

  axios.post(baseUri + '/api/v2/mobile/set_user_device_token',
    {
      token: qiscus.userData.token,
      device_token: tokenType,
      device_platform: platform
    }
    , {
      timeout: 5000
    })
    .then((response) => {
      console.warn('token: ', tokenType)
    })
    .catch((error) => {
      console.log('error: ', error)
    })
}
```

> Please note you can put anywhere outside `successLogin` but we recommend put this configuration in the callback after login successfully.

### Notification Events

You can handle the notification events both from background and foreground. Here is how to handle the events.

```
// Foreground
FCM.on(FCMEvent.Notification, async (notif) => {
  console.log(notif)
  if (notif.opened_from_tray) {
    // if notification click from tray
  }
})

// Background
FCM.getInitialNotification().then(notif => {
  if (notif !== undefined && notif !== null) {
    console.log(notif)
  }
})
```

> Please note you still need to implement local notification after FCM receive the events. You should read the details in the react-native-fcm library.
