# Getting Started

## Requirement

Qiscus Web Chat SDK, for now , supports Chrome 40+, Firefox 48+, and Microsoft Edge.
You will need to get our Web Chat SDK files from our CDN by including the Js and Css file.
**Qiscus SDK Js File**
```
https://qiscus-sdk.s3-ap-southeast-1.amazonaws.com/web/v2.8.4/qiscus-sdk.2.8.4.js
```
**Qiscus SDK Css File**
```
https://qiscus-sdk.s3-ap-southeast-1.amazonaws.com/web/v2.8.4/qiscus-sdk.2.8.4.css
```
We also provide CDN for production purpose with compression enabled.
**Qiscus SDK for Production**
```
https://d3p8ijl4igpb16.cloudfront.net/web/v2.8.4/qiscus-sdk.2.8.4.js
https://d3p8ijl4igpb16.cloudfront.net/web/v2.8.4/qiscus-sdk.2.8.4.css
```

## Getting Your App ID

To start building app using Qiscus Web Chat SDK you need a key called `APP ID`.
This `APP ID` acts as identifier of your Application so that Qiscus can connect
your user to other users on the same `APP ID`. You can get your `APP ID` [here](https://www.qiscus.com/dashboard).

You can find your `APP ID` on your Qiscus app dashboard. Here you can see the
picture as a reference.

![App ID Location](https://raw.githubusercontent.com/qiscus/qiscus-ui-vue/master/screenshots/app-id.png "Your APP ID location")

> All users within the same qiscus application are able to communicate with
> each other, across all platforms. This means users using iOS, Android, web
> clients, etc. can all chat with one another. However, users in different
> Qiscus applications cannot talk to each other.

## Authentication

To authenticate to SDK server, app needs to have user credential locally stored for further requests. The credential consists of a token that will identify a user in SDK server. When you want to disconnect from SDK server, terminating authentication will be done by clearing the stored credential. You can learn more about disconnecting from Qiscus Chat SDK in the next section. Qiscus SDK authentication can be done separately with your main app authentication, especially if your main app has functionality before the messaging features.

There are 2 type of authentication that you can opt to use: Client Authentication and Server Authentication.
Here some comparison to help you decide between the two options:

* Client Authentication can be done simply by providing userID and userKey through your client app. On the other hand, Server Authentication, the credential information is provided by your Server App. In this case, you need o prepare your own Backend.
* The Client Authentication is easier to implement but Server Authentication is more secure.


### Configuration

To configure Qiscus Web Chat SDK, you need to include SDK files that you get from requirement section into your HTML file. Here is how to include your files:

```html
<!-- put on your head element of your HTML file -->
<link rel="stylesheet" href="path/to/qiscus-sdk.css">
<!-- put on before closing tag of body tag -->
<script src="path/to/qiscus-sdk.js"></script>
```
To initiate your chat app using Qiscus Chat SDK, you need to include the `APP ID` that you obtained from your dashboard. Inside this `init function`, you can put more "options" according to what your app needs. For example, here we put an Event Handler ( ```loginSuccessCallback```) which will return information after the user has received a message (`userData`). You can, then, do something with that information inside the Event Handler. You can learn more about [Event Handler](https://www.qiscus.com/documentation/web/advanced-section), in the next chapter. Here is the sample code of how to initiate your APP ID and calling Event Handler :

```html
QiscusSDK.core.init({
  AppId: 'YOUR_APP_ID',
  options: {
    loginSuccessCallback: function (userData) {
      // Here you can do something about userData
    }
  }
});
```

>Please note that calling Event Handler is an option, not a mandatory thing to be included. You can still get your chat up and running without calling any of Event Handler.

### Client Authentication

You can easily authenticate your user by calling `QiscusSDK.core.setUser()` function. This function is used to login or register your user as well as setting and updating user profiles. Here is an example⁠⁠⁠⁠ :

```html
QiscusSDK.core.setUser('user@example.com', 'YOUR_USER_KEY', 'Qiscus Demo' , ‘http://some-url.com/avatar.png’);
```
Below are some notes to understand parameters within the ```setUser()``` function:

* **userID** (string, unique): A User identifier that will be used to identify a user and used whenever another user needs to chat with this user. It can be anything, whether it is the user's email address, your user database index, etc. as long as it is **unique** and a **string**.
* **userKey** (string) : `userKey` is used as for authentication purposes, so even if a stranger knows your userId, he cannot access the user data.
* **username** (string) : `Username` is used as a display name inside chat room.
* **avatar_url** (string, optional) : used to display user’s avatar, and fallback to default avatar if not provided.

You can learn from the figure below to understand what really happens when calling ```setUser()``` function :

![setUser Diagram](https://raw.githubusercontent.com/qiscus/qiscus-sdk-web/feature/docs/docs/images/1511248335-Set+user.png "setUser Diagram")

## Create Chat Room

**Chat Room** is a place where 2 or more users can chat with one another**.** There are 2 types of Chat Rooms that can be created using Qiscus Chat SDK: `1-on-1 Chat Room` and `Group Chat Room`. For some cases, a room can be identified by the room's `unique id` or `room name`. All activities under Qiscus Chat SDK is inside this Chat Room. You can do whatever you need with the available chat features.

To start creating Chat Room you need to create a container first, then render the Chat UI. `Container` is an element where Qiscus Web SDK Chat feature will be rendered into. To define container, you need to include ```<div id="qiscus-widget"></div>``` tag before the closing body tag. Here’s an example:

```html
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Document</title>
  <link rel="stylesheet" href="path/to/qiscus-sdk.css">
</head>
<body>
  <!-- append the snippet below, before closing body tag -->
  <div id="qiscus-widget"></div>
  <script src="path/to/qiscus-sdk.js"></script>
  ...
</body>
</html>
```
Don’t forget to save your file as HTML file.

>id value “qiscus-widget” is fixed. For now you cannot change it to anything else.

After creating a container, you need to set the user and render Qiscus Chat UI by calling render function.
```html
QiscusSDK.core.setUser('userId', 'userKey', 'Qiscus Demo', 'http://some-url.com/avatar.png')
QiscusSDK.render();
```

If everything is done properly you will get something like this
![sdk screen](https://raw.githubusercontent.com/qiscus/qiscus-ui-vue/master/screenshots/sdk-screen.png "SDK Screen")

The widget chat above appear and it seems inactive. This happened because you
have not set any target to chat with. But don't worry, the step-by-step guidance
to activate Chat Rooms will be explained in the next chapter (see Chat Rooms
section).

Here is the complete code.
<p data-height="265" data-theme-id="0" data-slug-hash="pWxQvJ" data-default-tab="html" data-user="qiscus" data-embed-version="2" data-pen-title="Qiscus Chat SDK Complete Code" class="codepen">See the Pen <a href="https://codepen.io/qiscus/pen/pWxQvJ/">Qiscus Chat SDK Complete Code</a> by Qiscus (<a href="https://codepen.io/qiscus">@qiscus</a>) on <a href="https://codepen.io">CodePen</a>.</p>
<script async src="https://production-assets.codepen.io/assets/embed/ei.js"></script>

## 1-on-1 Chat Room

`1-on-1 Chat Room` is a room which contains only 2 participants. In this room,
users will always enter the same room to chat each other and load previous
conversations. Here is the code to create 1-on-1 Chat Room using Qiscus Chat SDK.

`QiscusSDK.core.UI.chatTarget('[userId]')`

The code will load chat room previously created with the intended participants or create a new one if there is no record of it. It will also trigger the widget to expand if it's in minimized mode.

Here is the complete example of how to put `chatTarget` function:
```javascript
QiscusSDK.core.init({
  AppId: 'YOUR-APP-ID',
  options: {
    loginSuccessCallback: function (userData) {
      QiscusSDK.core.UI.chatTarget('userId')
    }
  }
})
```

In the snippet above, we put `chatTarget` function inside an Event Handler called
`loginSuccessCallback` (read in the next chapter for more detail about
_Event Handler_), to enable chatting after user successfully logged into the app.

> Please be noted that you can put chatTarget function anywhere you like.
> Calling it inside an Event Handler is just an example.

When everything is done correctly, you will see Qiscus Chat UI as showed in the
figure below:
![1-on-1 Screen](https://raw.githubusercontent.com/qiscus/qiscus-ui-vue/master/screenshots/1-on-1-screen.png "1-on-1 Screen")


## Group Chat Room

By creating group room you can have multiple users to chat inside specific room.
To create Group Chat Room you can do it like this:

```javascript
QiscusSDK.core.createGroupRoom(name, [userId1, userId2, userId3], { avatarURL: 'http://avatar_url.com/avatar.png' })
```

Those `userId1`, `userId2`, `userId3` will automatically be participants of the group room.

The code above will emit a `group-room-created` event which we can make use of by creating a `groupRoomCreated` callback method passed as init options the same way we did with `loginSuccessCallback` in the previous section.

```javascript
QiscusSDK.core.init({
  AppId: 'YOUR-APP-ID',
  options: {
    loginSuccessCallback: function (userData) {
      QiscusSDK.core.createGroupRoom(name, [userId1, userId2, userId3], { avatarURL: 'http://avatar_url.com/avatar.png' })
    },
    groupRoomCreatedCallback: function(room) {
      console.info('newly created room', room);
      QiscusSDK.core.UI.chatGroup(room.id)
    }
  }
})
```

## Channel

Channel is a room that behave similar like a group chat, in channel anyone can join using the room uniqueId, there are several limitation on channel like : no typing indicator, no read/deliver status, no comment info, and “delete for me” is not available. Here how you can create or join a Channel Room:

```javascript
QiscusSDK.core.getOrCreateRoomByChannel('channel-id', 'Channel Name', 'http://avatar-url.com/avatar.png')
  .then(function (roomData) {
    // Success create or opening channel
    console.log(roomData)
  })
```

## More About Rooms

After successfully creating your room, you may need to do advanced development for your chat app. This may include inviting more participant to your room, entering a specific room without invitation, and so on. Hence, in this section you will learn about the following things :

1. **Get Room List**, to get data of your user list so that you can use that data to load a specific room or many more.
2. **Enter to Existing Room**, to enable you to open a room that you have already created by passing a room ID that is obtained by Getting Room List.
3. **Participant Management**, to educate you on adding more participants to your room or managing users in your room.

### Get Room List

User will be able to participate in many rooms and our Chat SDK provide
functionality to list rooms which the user participate into. Here is how to get
the user's room list:
```javascript
QiscusSDK.core.loadRoomList(params): Promise<Array<Room>>
```

Where Room is an object as follow:
```json
{
  "id": 30524,
  "last_comment_id": 635013,
  "last_comment_message": "Hello there",
  "avatar": "",
  "name": "testGroup3",
  "comments": [],
  "count_notif": 0,
  "isLoaded": false,
  "unread_comments": [],
  "custom_title": null,
  "custom_subtitle": null,
  "options": "{}"
}
```

Here some parameters you should call with loadRoomList():
- *page* (number) on which set of data to be fetched
- *limit* (number, optional, default=100) limit on how many rooms data
to be fetched per page
- *show_participants* (boolean, optional, default=true) whether to list
participants of each rooms too

### Enter Existing Room

After successfully getting your room list, you may want to enter a specific room.
Remember that there are 2 type of rooms, `1-on-1 Chat Room` and `Group Room`. You
can enter `1-on-1 Chat Room` by simply using `chatTarget(user)` then passing
`userId` to chat with a single user. However, in Group Chat Room, instead
of `userId`, you need to pass a `roomId` by using `chatGroup()` function. This
`roomId` can be obtained by loading room list, which has been explained in
the previous chapter.

Example:
```javascript
QiscusSDK.core.UI.chatGroup('room-id')
```

### Participant Management

In some cases, you may need to add additional participants into your room chat
or even removing any participant. Currently, Qiscus Chat SDK allow you or even removing any participant. This two methods you can use to managing participant.

```javascript
QiscusSDK.core.addParticipantsToGroup(roomId, [userId1, userId2, userId3])
```

```javascript
QiscusSDK.core.removeParticipantsFromGroup(roomId, [userId1, userId2, userId3])
```

## Enable Desktop Notification

By default, desktop notification feature is available on your web browser. To get notification, you need to enable browser notification on the browser pop-up.

Here's an example on how to display a desktop notification when the window is not on focus by using `newMessagesCallback` event handler:

```javascript
newMessagesCallback(messages) {
  //  request permission if it is disabled
  if (Notification.permission !== "granted") Notification.requestPermission();
  // create the notification if only window is not focused
  if ( document.hasFocus() ) return
  // create the notification
  const notification = new Notification(`you get a chat from ${messages[0].username}`, {
    icon: messages[0].user_avatar,
    body: (messages[0].message.startsWith('[file]'))
          ? 'File attached.'
          : messages[0].message,
    });
  // add on click event handler, close the notif, focus the window
  notification.onclick = function () {
    notification.close();
    window.focus();
  }
  }
```

You can learn more about Event Handler in the next section.
