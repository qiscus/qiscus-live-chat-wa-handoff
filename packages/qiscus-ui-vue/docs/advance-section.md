# Advance Section

## Server Authentication

Another option is to authenticate using Json Web Token [(JWT)](https://jwt.io/). Json Web Token contains your app account details which typically consists of a single string which contains information of two parts, Jose header and JWT claims set. 

The steps to authenticate with JWT goes like this:

1. The Client App request a nonce from Qiscus SDK server
2. Qiscus SDK Server will send Nonce to client app
3. Client App send user credentials and Nonce that is obtained from Qiscus SDK Server to Client app backend
4. The Client App backend will send the token to client app
5. The Client App send that token to Qiscus Chat SDK
6. Qiscus Chat SDK send Qiscus Account to Client app

<p align="center"><br/><img src="https://raw.githubusercontent.com/qiscus/qiscus-sdk-android/develop/screenshot/jwt.png" width="80%" /><br/></p>

You need to request Nonce from Qiscus Chat SDK Server. Nonce (Number Used Once) is a unique, randomly generated string used to identify a single request. Please be noted that a Nonce will expire in 10 minutes. So you need to implement your code to request JWT from your backend right after you got the returned Nonce. Here is how to authenticate to Qiscus Chat SDK using JWT :
```javascript
QiscusSDK.core.getNonce(): Promise<NonceData>
```
The code above is a sample of method you can implement in your app. By calling QiscusSDK.core.getNonce(), you will request Nonce from Qiscus SDK server and a Nonce will be returned. If it is success, you can request JWT from your backend by sending Nonce you got from Qiscus SDK Server. 
When you got the JWT Token, you can pass that JWT to QiscusSDK.core.verifyIdentityToken method to allow Qiscus to authenticate your user and return user account through QiscusSDK.core.setUserWithIdentityToken(Response), as shown in the code below :

```javascript
QiscusSDK.core.verifyIdentityToken(*YOUR_IDENTITY_TOKEN*)
.then(userData => QiscusSDK.core.setUserWithIdentityToken(userData))
   ```

If you are wondering the full implementation of JWT authentication, here is the full code sample:

```javascript
QiscusSDK.core.getNonce()
        .then((res) => {
           // this is your API
          const data = {
            user: {
              app_id: __APP_ID__,
              phone_number: `${this.countryCode}${phone}`,
              passcode: this.passCode,
              nonce: res.nonce,
            },
          };
          axios.post(`${YOUR__API__}auth/verify`, data)
          .then((response) => {
            this.loader = false;
            QiscusSDK.core.verifyIdentityToken(response.data.identity_token)
              .then((verifyResponse) => {
                QiscusSDK.core.setUserWithIdentityToken(verifyResponse);
              }, error => this.setErrorMessage(`Failed Signing In. ${error}`));
          }, () => {
            this.loader = false;
            this.setErrorMessage('Failed Signing In.');
          });
        }, err => this.setErrorMessage(`Failed getting auth nonce ${err}`));
```

### Setting JOSE header and JWT Claim Set in your backend

When your backend returns a JWT after receiving Nonce from your client app, the JWT will be caught by client app and will be forwarded to Qiscus Chat SDK Server. In this phase, Qiscus Chat SDK Server will verify the JWT before returning Qiscus Account for your user. To allow Qiscus Chat SDK Server successfully recognize the JWT, you need to setup Jose Header and JWT claim set in your backend as follow :

**Jose Header :**
```
{
  "alg": "HS256",  // must be HMAC algorithm
  "typ": "JWT", // must be JWT
  "ver": "v2" // must be v2
}
```
**JWT Claim Set :**
```
{
  "iss": "QISCUS SDK APP ID", // your qiscus app id, can obtained from dashboard
  "iat": 1502985644, // current timestamp in unix
  "exp": 1502985704, // An arbitrary time in the future when this token should expire. In epoch/unix time. We encourage you to limit 2 minutes
  "nbf": 1502985644, // current timestamp in unix
  "nce": "nonce", // nonce string as mentioned above
  "prn": "YOUR APP USER ID", // your user identity such as email or id, should be unique and stable
  "name": "displayname", // optional, string for user display name
  "avatar_url": "" // optional, string url of user avatar
}
```
## UI Customization

Qiscus Chat SDK enable you to customize Chat UI as you like. You can modify
colors, change bubble chat design, modify Chat Header, and many more.
There are 2 level of UI customization, Basic and Advance Customization.
For advance customization, you need to posssess enough understanding of CSS.

### Basic UI Customization

#### View Mode

If you want to display your chat as a full width (not as widget), you can
set the mode to wide on init as a parameter, as figure below:
```javascript
QiscusSDK.core.init({
  AppId: 'YOUR-APP-ID',
  mode: 'wide',
  options: {}
})
```

### CSS Customization

You can almost change everything you see on the chat UI by customizing it's CSS.
Here are main CSS selectors being use in Qiscus Chat SDK:

| CSS Properties      | Description                                |
|---------------------|--------------------------------------------|
| .qcw-trigger-button | Button for toggling the chat window        |
| .qcw-container      | Widget window wrapper div                  |
| .qcw-header         | Widget header containing active chat title |

> Please be noted that SDK css classess is prefixed with qcw-

There are more than just 3 properties that are unlisted in the table above. You
can find more customizable properties in the css file in the sample app, which
you can modify it as you like.

### Bubble Customization

for customizing custom message bubble you can put it in `init` option. And then you can apply a custom html element css classes.You can even pass the data there.

For more details information, you can check our example here 
[Sample Feature Custom Message in Sample Web SDK](https://github.com/qiscus/qiscus-sdk-web-sample/blob/feature%2Fcustom-message/assets/js/main.js#L126)

### Advance Customization

For advance customization, you can only use our Core SDK API for the data flow and use your own full UI. By using this approach you will have full control over the UI. We have sample on how you can do it and there are documentation on list of core api that we provide in the SDK. check it here [https://bitbucket.org/qiscus/qiscus-sdk-core-web-sample](https://bitbucket.org/qiscus/qiscus-sdk-core-android-sample)


## Event Handler

An Event Handler is a callback routine that operates asynchronously and handles
inputs received into a program. Event Handlers are important in Qiscus because
it allows a client to react to any events happening in Qiscus Chat SDK.
For example, if a client wants to know any important events from server, such
as success login event, client's app can be notified by calling a specific
Event Handler. Client, then, can do things with data returned by the event.

In the previous section, during `Qiscus.init` (see [Configuration](/documentation/web/create-your-app#configuration) section), you
can put callbacks inside options as parameters that will be called when there's
event being triggered. You can see it inside options in the `Qiscus.core.init`
function when you initialize Qiscus Chat SDK.

Here are the complete Event Handlers list that are supported by
Qiscus Chat SDK. If you cannot find Event Handler that suit your need, you
can contact us at [contact.us@qiscus.com](mailto:contact.us@qiscus.com), so
that we can consider it for your need.
- [loginSuccessCallback](#loginsuccesscallback)
- [newMessageCallback](#newmesagescallback)
- [chatRoomCreatedCallback](#chatroomcreatedcallback)
- [groupRoomCreatedCallback](#grouproomcreatedcallback)
- [headerClickedCallback](#headerclickedcallback)
- [commentDeliveredCallback](#commentdeliveredcallback)
- [commentReadCallback](#commentreadcallback)

### loginSuccessCallback

`loginSuccessCallback` is called when user is successfully logged in to
Qiscus Chat SDk using `setUser` function. This Event Handler can be used either
to notify your user or do something inside your application. This Event Handler
return an object of the corresponding user data.
```javascript
/**
 * @params loginResponse {LoginResponse}
 */
loginSuccessCallback: function (loginResponse) {
  // Do everything you want here
}
```
Where `loginResponse` are an object as follow:
```json
{
  "results": {
    "user": {
      "app": {
        "code": "sampleapp-65ghcsaysse",
        "id": 1212,
        "id_str": "1212",
        "name": "sampleApp"
      },
      "avatar": {
        "avatar": {
          "url": "https://www.gravatar.com/avatar/5b0f8ddf669065e52248a118f33527f4?d=retro"
        }
      },
      "avatar_url": "https://www.gravatar.com/avatar/5b0f8ddf669065e52248a118f33527f4?d=retro",
      "email": "afief",
      "id": 339435,
      "id_str": "339435",
      "last_comment_id": 1615626,
      "last_comment_id_str": "1615626",
      "last_sync_event_id": 0,
      "pn_android_configured": true,
      "pn_ios_configured": true,
      "rtKey": "somestring",
      "token": "YOUR_IDENTITY_TOKEN",
      "username": "afief"
    }
  },
  "status": 200
}
```

### newMesagesCallback

`newMessagesCallback` is called when there is new incoming message. This Event
Handler can be used either to notify your user using desktop notification, or
somethhing else. This Event handler returns data of incoming message.
```javascript
/**
 * @params messages {Messages}
 */
newMessagesCallback: function (messages) {
  // Do everything you want here
}
```
Where messages are an array of unread message as follow:
```json
[
  {
    "chat_type": "single",
    "comment_before_id": 1615626,
    "comment_before_id_str": "1615626",
    "created_at": "2018-03-08T04:39:05.270018Z",
    "disable_link_preview": false,
    "email": "apiep",
    "extras": {},
    "id": 1615742,
    "id_str": "1615742",
    "message": "qweasd",
    "payload": null,
    "raw_room_name": "afief",
    "room_avatar": "https://www.gravatar.com/avatar/59d39ae46c5f549e8e76d2733a91e19a?d=retro",
    "room_id": 68463,
    "room_id_str": "68463",
    "room_name": "apiep",
    "room_type": "single",
    "timestamp": "2018-03-08T04:39:05Z",
    "topic_id": 68463,
    "topic_id_str": "68463",
    "type": "text",
    "unique_temp_id": "bq1520483946102",
    "unix_nano_timestamp": 1520483945270018000,
    "unix_timestamp": 1520483945,
    "user_avatar": "https://www.gravatar.com/avatar/59d39ae46c5f549e8e76d2733a91e19a?d=retro",
    "user_avatar_url": "https://www.gravatar.com/avatar/59d39ae46c5f549e8e76d2733a91e19a?d=retro",
    "user_id": 544062,
    "user_id_str": "544062",
    "username": "apiep"
  }
]
```

### chatRoomCreatedCallback

`chatRoomCreatedCallback` is called when user successfully created a 1-on-1
Chat Room. This event handler can be used either to notify your user or
for analytics purpose. This event handler return data of created room.
```javascript
/**
 * @params room {Room}
 */
chatRoomCreatedCallback: function (room) {
  // Do everything you want here
}
```
Where room are an object of the corresponding room data
```json
{
  "room": {
    "id": 41710,
    "last_comment_id": 0,
    "last_comment_message": "",
    "last_comment_topic_id": 41710,
    "avatar": "https://qiscuss3.s3.amazonaws.com/uploads/55c0c6ee486be6b686d52e5b9bbedbbf/2.png",
    "name": "aa",
    "participants": [
      {
        "avatar_url": "https://qiscuss3.s3.amazonaws.com/uploads/55c0c6ee486be6b686d52e5b9bbedbbf/2.png",
        "email": "customer-service@email.com",
        "id": 131324,
        "id_str": "131324",
        "last_comment_read_id": 0,
        "last_comment_read_id_str": "0",
        "last_comment_received_id": 0,
        "last_comment_received_id_str": "0",
        "username": "Customer Service"
      },
      {
        "avatar_url": "https://qiscuss3.s3.amazonaws.com/uploads/55c0c6ee486be6b686d52e5b9bbedbbf/2.png",
        "email": "aa@email.com",
        "id": 185243,
        "id_str": "185243",
        "last_comment_read_id": 0,
        "last_comment_read_id_str": "0",
        "last_comment_received_id": 0,
        "last_comment_received_id_str": "0",
        "username": "aa"
      }
    ],
    "topics": [],
    "comments": [],
    "isLoaded": false,
    "unread_comments": [],
    "custom_title": null,
    "custom_subtitle": null
  }
}
```

### groupRoomCreatedCallback

`groupRoomCreatedCallback` is called when user successfully created a group
room. This event handler can be used either to notify your user or for
analytics purpose. This event handler return data of the created
group room data.
```javascript
/**
 * @params room {GroupRoom}
 */
groupRoomCreatedCallback: function (room) {
  // Do everything you want here
}
```
Where room are an object of the corresponding group room data.
```json
{
  "id": 107128,
  "name": "group name name",
  "lastCommentId": 0,
  "lastCommentMessage": "",
  "lastTopicId": 107128,
  "avatarURL": "https://d1edrlpyc25xu0.cloudfront.net/kiwari-prod/image/upload/E2nVru1t25/1507541900-avatar.png",
  "options": "{}",
  "participants": [
    {
      "id": 339435,
      "email": "afief",
      "username": "afief",
      "avatarURL": "https://www.gravatar.com/avatar/5b0f8ddf669065e52248a118f33527f4?d=retro"
    },
    {
      "id": 544062,
      "email": "apiep",
      "username": "apiep",
      "avatarURL": "https://www.gravatar.com/avatar/59d39ae46c5f549e8e76d2733a91e19a?d=retro"
    }
  ]
}
```

### headerClickedCallback

`headerClickedCallback` is called when user click header or area around
room name and room avatar. This event can be used either to show room detail,
or something else.
```javascript
headerClickedCallback: function () {
  // Do something when user click header area
}
```

### commentDeliveredCallback
`commentDeliveredCallback` event handler will be called when user's comment
has been delivered to it's participants. You can use this for analytics
purpose, user delivery receipt, etc. `commentDeliveredCallback` returns an
object of delivered message data.
```javascript
commentDeliveredCallback: function (comment) {
  // Do everything you want here
}
```

### commentReadCallback
`commentReadCallback` event handler will be called when user's comment has
been delivered and read by targeted user. You can use this for analytics
purpose, user delivery receipt, etc. `commentReadCallback` returns an
object of read message data.
```javascript
commentReadCallback: function (comment) {
  // Do everything you want here
}
```

When you put the code altogether, it will look like this:
```javascript
QiscusSDK.core.init({
  AppId: 'YOUR_APP_ID',
  options: {
    loginSuccessCallback: function (loginResponse) {},
    newMessageCallback: function (messages) {},
    chatRoomCreatedCallback: function (chatRoom) {},
    groupRoomCreatedCallback: function (groupRoom) {},
    headerClickedCallback: function () {},
    commentDeliveredCallback: function (comment) {},
    commentReadCallback: function (comment) {}
  }
})
```
