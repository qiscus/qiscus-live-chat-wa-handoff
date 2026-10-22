# Web SDK API Reference

## Init

### Using App ID

```
qiscus.init({
  // change this into your own AppId through https://dashboard.qiscus.com
  AppId: 'sdksample',
  options: {
    loginSuccessCallback: function() {
      // example: start chatting with another user after successfully login
      qiscus.chatTarget('user@example.com').then(res => {
        console.info('chat with user@example.com', qiscus.selected);
      });
    },
    loginErrorCallback(data) {},
    newMessagesCallback(data) {},
    groupRoomCreatedCallback(data) {},
  },
  mode: 'widget', // widget | wide
  mqttURL: '...', // custom mqtt URL
  baseURL: '...', // custom base URL
});
```

### Using custom server

```
qiscus.init({
  // change this into your own AppId through https://dashboard.qiscus.com
  AppId: 'sdksample',
  options: { },
  mqttURL: '...', // custom mqtt URL
  baseURL: '...', // custom base URL
});
```

## Authentication

### Using `UserID` and `UserKey`

```
/*
@param userId <String> unique identifier of a user
@param userKey <String> password
@param username <String> name to be displayed on chat
@param extras <JSON | Optional> extra data tobe attached to this user (e.g.: { role, type, subscribtion, ... })
*/
qiscus.setUser(userID, userKey, username, avatar, extras);
// loginSuccessCallback | loginErrorCallback will be triggered by this point
```

### Using JWT

Client side need to call this function.

```
let nonce;
qiscus.getNonce().then(res => nonce = res);
```

You need to get Identity Token from you custom JWT API by using the nonce. Last step are to verify Identity Token by using this function.

```
qiscus.verifyIdentityToken(identityToken).then(res => identityToken = res);
```

Login or register with Identity Token.

```
qiscus.setUserWithIdentityToken(identityToken);
// loginSuccessCallback | loginErrorCallback will be triggered by this point
```

## User

### User Data

```
qiscus.userData
```

### Update user profile

```
/*
params:
@param name <String> update name to be displayed to other user
@param avatar_url <String> update avatar url
@param extras <JSON | Optional> extra data to be attached to this user (e.g.: { role, type, subscribtion, ... })
*/

qiscus.updateProfile(username, avatar, extras)
```

### Login Status

```
qiscus.isLogin // return true or false
```

### Block User

```
qiscus.blockUser(userId): Promise<User>
```

### Unblock User

```
qiscus.unblockUser(userId): Promise<User>
```

### Get Blocked User

```
qiscus.getBlockedUser(): Promise<Array<User>>
```

### Logout

```
qiscus.logout();
```



## Message

### Send Text Message

```
qiscus.sendComment(roomId, 'my message', null, 'text', null, null);
```

### Send File Attachment

```
const filePayload = JSON.stringify({
    url: "https://res.cloudinary.com/qiscus/image/upload/USWiylE7Go/ios-15049438515185.png",
    caption: "Ini gambar siapa?"
});
qiscus.sendComment(roomId, 'check my image', null, 'file_attachment', filePayload, null);
```

### Send Custom Message

```
const customPayload = JSON.stringify({
  type: 'my-awesome-profile-card',
  content: {name, phone, ...}
});
qiscus.sendComment(roomId, 'check my profile card', null, 'custom', customPayload, null);
```

### Send Carousel

```
const carouselPayload = JSON.stringify({
  cards: [{
    image:"http://url.com/gambar.jpg",
    title:"Atasan Blouse Tunik Wanita Baju Muslim Worie Longtop",
    description:"Oleh sippnshop\n96% (666 feedback)\nRp 49.000.00,-\nBUY 2 GET 1 FREE!!!",
    default_action: {
      type:"postback",
      postback_text:"Load more",
      payload:{
        url:"http://url.com/baju?id=123&track_from_chat_room=123",
        method:"get",
        payload:null
      }
    },
    buttons:[
       {
        label:"button1",
        postback_text:"Load more",
        type:"postback",
        payload:{
          url:"http://somewhere.com/button1",
          method:"get",
          payload:null
        }
      },
      {
        label:"button2",
        postback_text:"",
        type:"link",
        payload:{url:"http://somewhere.com/button2?id=123","method":"get","payload":null}
      }
    ]
  }]
});
qiscus.sendComment(roomId, 'test carousel', null, 'carousel', carouselPayload, null);
```

### Load Messages

```
options = {
  last_comment_id: 10,
  after: true/false,
  limit: 10
}

qiscus.loadComments(room_id, options = {})
  .then(res => {
    // do something
  }, err => {
    // throw the error to your log of choice
  });
```

### Load More

```
options = {
  limit: 20
}

qiscus.loadMore(last_comment_id, options = {})
  .then( res => {
    console.info(res);
  }, err => {
    throw new Error(err);
  });
```

### Delete Message

```
/**
  * Params consisted of
  * @param {room_id} room id
  * @param {room_unique_ids} array of room unique ids
  * @param {is_delete_for_everyone} delete for everyone, default false
  * @param {is_hard_delete} soft delete is false, harde delete will be true, default false

QiscusSDK.core.deleteComment(roomId, [comment.unique_id], is_delete_for_everyone, is_hard_delete)
```

### Clear Message

```
/**
  * Params consisted of
  * @params {room_unique_ids} array of room unique ids

QiscusSDK.core.clearRoomMessages([room_unique_ids])
```

## Room

### Create 1-on-1 Chat Room

```
 // return Promise also triggering chatRoomCreatedCallback() of init options
qiscus.chatTarget(userId).then(res => {
 // do something here
 console.log(res);
});});
```

### Create Group Room

```
users = [user1, user2, user3]
options = {
  "avatar_url": "https://mybucket.com/image.jpg"
}
createGroupRoom (name, users, options)
  .then(res => {
    new Notification('Success', { body: `Room created`});
  }, err => {
    throw new Error(err);
  });
// return promise
// also triggered groupRoomCreatedCallback();
```

### Get Chat Room By ID

```
// return promise
qiscus.getRoomById(id).then(res => {
  // do something, notify user, etc
}, err => {
  // log? throw err?
})
```

### Get Chat Room By Channel

```
qiscus.getOrCreateRoomByChannel(channel).then(res => {
  // do something, notify user, etc
}, err => {
  // log? throw err?
});
```

### Get Currently Selected Chat Room Participants

```
qiscus.selected.participants
// return array of participants object
// format [{email,username},...}]
```

### Get Rooms Info

```
/**
  * Params consisted of
  * @param {room_ids} array of room ids
  * @param {room_unique_ids} array of of room unique ids
  * @param {show_participants} show list of participants, default true
  * @param {show_removed} show removed room, default false
  * @returns Promise
  * @memberof QiscusSDK
  */
qiscus.getRoomsInfo(params).then(res => {
  // display the data in modal box?
}, err => {
  // log? throw err?
})
```

### Loaded Rooms

```
qiscus.rooms
```

### Available Room Methods

```
qiscus.rooms[index].setTitle() // change room name to custom one
qiscus.room[index].setSubTitle() // add sub title (under room name)
qiscus.room[index].isCurrentlySelected() // check if room is selected
qiscus.room[index].getParticipant(uniqueId) // get participant
qiscus.room[index].addParticipant(<participant>) // add a new participant object
```

### Get Room List

```
qiscus.loadRoomList().then(res => {
  // populate our own rooms list?
  this.conversations = res;
}, err => {
  // log? throw err?
}); // return Promise
```

### Update Room

```
/**
* Update room
* @param {id, room_name, avatar_url, options} args
* @param id <Int> required
* @param room_name <String> optional
* @param avatar_url <String> optional
* @param options <Object> optional
* @return Promise
*/
qiscus.updateRoom({id: 1, room_name: 'test room', avatar_url: 'http://my.url', options: {official: false}}).then(res => {
  // do something, notify user, etc
}, err => {
  // log? throw err?
})
```

### Currently Selected Rooms

```
qiscus.selected // room info
qiscus.selected.comments // comments list
```

### Add participant in a room

```javascript
QiscusSDK.core.addParticipantsToGroup(roomId, [userId1, userId2, userId3])
```

### Remove participant in a room
```javascript
QiscusSDK.core.removeParticipantsFromGroup(roomId, [userId1, userId2, userId3])
```

## Statuses

### Publish Start Typing

```
qiscus.publishTyping(1);
```

### publish stop typing

```
qiscus.publishTyping(0)
```

### Update Message Read Status

```
qiscus.readComment(room_id, comment_id);
```

### update Message Receipt Status

```
qiscus.receiveComment(room_id, comment_id);
```

## Event Handler

### Login Success Callback

```
 qiscus.init({
  AppId: ...,
  options: {
    loginSuccessCallback(response) {
      // example: chat with user when login is successful
      qiscus.chatTarget(userId);
    }
  }
});
```

### Login Error Callback

```
qiscus.init({
  AppId: ...,
  options: {
    loginErrorCallback(error) {
      // example: notify user there's problem
      throw new Error(error);
    }
  }
});
```

### New Messages Callback

```
qiscus.init({
  AppId: ...,
  options: {
    newMessagesCallback(messages) {
      // example: set desktop notification for incoming comment
      //  request permission if it is disabled
      if (Notification.permission !== "granted") Notification.requestPermission();
      // create the notification if only window is not focused
      if ( document.hasFocus() )) return
      messages.forEach(message => {
        let notif = new Notification(`New message from ${message.username}`, {
          body: message.message
          icon: your-icon-url
        });
        notif.onClick = function(){
          notif.close();
          window.focus();
        }
      })
    }
  }
});
```

Sample messages payload.

```
[{
  "chat_type": "single",
  "comment_before_id": 827962,
  "comment_before_id_str": "827962",
  "disable_link_preview": false,
  "email": "customer-service@email.com",
  "id": 827963,
  "id_str": "827963",
  "message": "adf;lkjadsf",
  "payload": null,
  "room_avatar": "",
  "room_id": 30418,
  "room_id_str": "30418",
  "room_name": "Customer Service",
  "timestamp": "2017-09-29T10:51:25Z",
  "topic_id": 30418,
  "topic_id_str": "30418",
  "type": "text",
  "unique_temp_id": "bq1506682285227",
  "unix_nano_timestamp": 1506682285076080000,
  "unix_timestamp": 1506682285,
  "user_avatar": {
    "avatar": {
      "url": "https://qiscuss3.s3.amazonaws.com/uploads/55c0c6ee486be6b686d52e5b9bbedbbf/2.png"
    }
  },
  "user_avatar_url": "https://qiscuss3.s3.amazonaws.com/uploads/55c0c6ee486be6b686d52e5b9bbedbbf/2.png",
  "user_id": 131324,
  "user_id_str": "131324",
  "username": "Customer Service"
}]
```

### Presence Callback

```
qiscus.init({
  AppId: ...,
  options: {
    presenceCallback(data) {
      // doing something here
    }
  }
});
```

### Typing Callback

```
qiscus.init({
  AppId: ...,
  options: {
    typingCallback(data) {
      // doing something here
    }
  }
});
```

### Comment Delivered Callback

```
qiscus.init({
  AppId: ...,
  options: {
    commentDeliveredCallback(data) {
      // doing something here
    }
  }
});
```

### Comment Read Callback

```
qiscus.init({
  AppId: ...,
  options: {
    commentReadCallback(data) {
      // doing something here
    }
  }
});
```

## Custom Event

### Publish Event

```
QiscusSDK.core.publishEvent(roomId: string, payload: object): null
```
Will throw some error if
- `roomId` is undefined throw an Error with message of "'roomId' required"
- `roomId` is not string throw a TypeError with message of "'roomId' must have type of string"
- `payload` is null / undefined throw an Error with message of "'payload' required"
- `payload` is not an object throw a TypeError with message of "'payload' must have type of object"

### Subscribe Event

```
QiscusSDK.core.subscribeEvent(roomId: String, callback: (payload: object) -> null): null
```
Will throw some error if
- `roomId` is undefined throw an Error with message of "'roomId' required"
- `roomId` is not string throw a TypeError with message of "'roomId' must have type of string"
- `callback` is null / undefined throw an Error with message of "'callback' required"
- `callback` is not an object throw a TypeError with message of "'callback' must have type of function"

### Unsubscribe Event

```
QiscusSDK.core.unsubscribeEvent(roomId: string): null
```
Will throw error if
- `roomId` is undefined throw an Error with message of "'roomId' required"
- `roomId` is not string throw a TypeError with message of "'roomId' must have type of string"
