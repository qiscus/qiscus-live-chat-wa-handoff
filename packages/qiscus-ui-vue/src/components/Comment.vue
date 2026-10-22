<template lang="pug">
  div(:class="{'parent--container':isParent, 'my--container': isMe, 'qcw-group': isGroupRoom, 'contain-date': showDate, 'deleted': isDeleted }")
    div(class='qcw-comment-container' :id="comment.id" :class="{[`qcw-comment--${this.comment.type}`]: true,'comment--me': isMe, 'qcw-comment--cust': isCustomer, 'qcw-comment--sticker': isSticker}")
      div(v-if="showDate" class="qcw-comment-date")
        div {{ dateToday }}
      div(v-if="comment.type == 'system_event'" class="qcw-comment--system-event")
        comment-custom(v-if="core.customTemplate && haveTemplate(comment)" :data="systemEventComment")
        div(v-else)
          //- v-html (not {{ }}) so http(s) URLs render as clickable links.
          //- systemEventHtml escapes before linkifying — safe against injection.
          div(v-html="systemEventHtml")

      div
        div(
          class="qcw-comment"
          v-if="comment.type != 'system_event'"
          :class="{ 'comment--me': isMe, 'comment--parent': isParent, 'comment--mid': isMid, 'comment--last': isLast && !isCarousel && !comment.extras.is_echo && !broadcasterName, 'comment--last-carousel':  isLast && isCarousel }"
        )
          div(class="qcw-comment__message"
            :style="messageStyle"
            :class="{'message__image': isMeFileImageAttachment,'message__bot': isReplayBot,'extra-margin carousel': comment.type === 'carousel','sticker':isSticker  && !isStickerAds,'card':comment.type === 'card','hover-effect':!isDeleted && !isCustomBuble && !isSticker, 'qcw-comment-prevsession':isPreviousSessionMessageNotifier, 'message__broadcast_button' : isMessageButtonBc, 'message__broadcast_button--with-sender' : isMessageButtonBc && broadcasterName, 'message__flow_interactive' : isMessageFlowInteractive ||  isInteractiveCtaUrl, 'message__request_contact_button' : isRequestContactButton }")

            //- Only for buble tip, for supporting js styling
            // div.tip(
            //   :style="tipMessageStyle"
            // )

            div(v-if="!isMe && isParent" class="qcw-comment__header")
              avatar(:src="commentAvatar(avatar)" :class="{'qcw-avatar--hide': !isParent}")

              //- Comment User
              //- span(class="qcw-comment__username" v-if="isParent && isGroupRoom && !isMe") {{comment.username_as}}
              span(class="qcw-comment__username" :class="{'qcw-comment__username--hide': isMe}" v-if="isParent" :title="username" v-html="sanitizeHTML(username)")

            //- reply button
            div(class="reply-btn-wrapper" :style="!isInboxMode ? { right: '-35px !important' } : { right: '-53px'  }" v-if="!isDeleted && !isMe && !isSticker")
              i(@click="replyHandler(comment)" class="reply-btn" :class="{'reply-btn--me': isMe}")
                icon(name="ic-reply")
              span(class="qcw-comment__time--second") {{ isInboxMode ? timestamp : comment.time }}

            //- more vertical button
            div(class="qcw-comment__more-wrapper" :style="!isInboxMode ? { left: '-35px' } : { left: '-55px'  }" v-if="isMe && !isDeleted")
              i(class="qcw-comment__more" @click="menuMoreClicked(comment.id)")
                icon(name="ic-more-horiz")
              span(class="qcw-comment__time--second") {{ isInboxMode ? timestamp : comment.time }}

            div(
              :key="`comment_${comment.id}`"
              ref="`more_${comment.id}`"
              class="qcw-comment__more--menu"
              v-if="isMe && !isDeleted && showMenuMore && !isSticker"
              v-click-outside="onClickMenuOutside"
              )
              ul(v-if="!comment.isFailed")
                li(@click="replyHandler(comment)") Reply

            //- from tiktok ads
            div(v-if="isTiktokAdsComment")
              comment-tiktok-ads(:comment="comment")

            div(v-else-if="isMessageButtonBc" style="width: 100%;")
              comment-broadcast-button(:comment="comment" :message-style="messageStyle")
              span(v-if="isInboxMode" class="qcw-comment__time") {{comment.time}}
              //- State
              div(v-if="isMe")
                div(class="qcw-comment__state qcw-comment__state--sending" v-if="comment.isPending")
                  icon(name="ic-load" class="ic-load__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state" v-if="!comment.isChannel && comment.isSent && !comment.isDelivered")
                  icon(name="ic-check" class="ic-check__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state qcw-comment__state--delivered" v-if="!comment.isChannel && comment.status=='delivered'")
                   icon(name="ic-double-check" class="ic-double-check__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state qcw-comment__state--read" v-if="!comment.isChannel && comment.status=='read'")
                   icon(name="ic-double-check" class="ic-double-check__state")

            div(v-else-if="isRequestContactButton" style="width: 100%;")
              comment-request-contact(:comment="comment")
              span(v-if="isInboxMode" class="qcw-comment__time") {{comment.time}}
              //- State
              div(v-if="isMe")
                div(class="qcw-comment__state qcw-comment__state--sending" v-if="comment.isPending")
                  icon(name="ic-load" class="ic-load__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state" v-if="!comment.isChannel && comment.isSent && !comment.isDelivered")
                  icon(name="ic-check" class="ic-check__state" :fill="messageStatusIconStyle")
                //- div(@click="resend(comment)" class="qcw-comment__state qcw-comment__state--failed"
                //-   v-if="comment.isFailed" :style="messageFailedIconStyle")
                //-   icon(name="ic-warning-circle" class="ic-failed__state")
                div(class="qcw-comment__state qcw-comment__state--delivered" v-if="!comment.isChannel && comment.status=='delivered'")
                   icon(name="ic-double-check" class="ic-double-check__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state qcw-comment__state--read" v-if="!comment.isChannel && comment.status=='read'")
                   icon(name="ic-double-check" class="ic-double-check__state")

            div(v-else-if="isMessageFlowInteractive" style="width: 100%;")
              comment-flow-interactive(
                :comment="comment"
                :whitelisted-files="whitelistedFiles"
                :on-click-image="onClickImage"
                :callback="onupdate"
                :isMe="isMe")
              span(v-if="isInboxMode" class="qcw-comment__time") {{comment.time}}
              //- State
              div(v-if="isMe")
                div(class="qcw-comment__state qcw-comment__state--sending" v-if="comment.isPending")
                  icon(name="ic-load" class="ic-load__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state" v-if="!comment.isChannel && comment.isSent && !comment.isDelivered")
                  icon(name="ic-check" class="ic-check__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state qcw-comment__state--delivered" v-if="!comment.isChannel && comment.status=='delivered'")
                    icon(name="ic-double-check" class="ic-double-check__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state qcw-comment__state--read" v-if="!comment.isChannel && comment.status=='read'")
                    icon(name="ic-double-check" class="ic-double-check__state")

            div(v-else-if="isInteractiveCtaUrl" style="width: 100%;")
              comment-cta-interactive(
                :comment="comment"
                :whitelisted-files="whitelistedFiles"
                :on-click-image="onClickImage"
                :callback="onupdate"
                :isMe="isMe")
              span(v-if="isInboxMode" class="qcw-comment__time") {{comment.time}}
              //- State
              div(v-if="isMe")
                div(class="qcw-comment__state qcw-comment__state--sending" v-if="comment.isPending")
                  icon(name="ic-load" class="ic-load__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state" v-if="!comment.isChannel && comment.isSent && !comment.isDelivered")
                  icon(name="ic-check" class="ic-check__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state qcw-comment__state--delivered" v-if="!comment.isChannel && comment.status=='delivered'")
                    icon(name="ic-double-check" class="ic-double-check__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state qcw-comment__state--read" v-if="!comment.isChannel && comment.status=='read'")
                    icon(name="ic-double-check" class="ic-double-check__state")

            //- from fb ads
            div(v-else-if="isFbAdsComment")

              comment-fb-ads(:comment="comment")

                //- CommentType: "TEXT"
                div(class="comment-text" v-if="(comment.type == 'text' || comment.type == 'reply') && !isSticker && !isInteractiveListMessage && !isInteractiveQuickReply && !isMediaTimeout && !isPreviousSessionMessageNotifier && !isInteractiveVoiceCall && !isInteractiveCallPermissionRequest && !isOutgoingCall")
                  image-loader(v-if="comment.isAttachment(comment.message) && comment.type != 'reply'"
                    :comment="comment"
                    :message="comment.message"
                    :whitelisted-files="whitelistedFiles"
                    :on-click-image="onClickImage"
                    :callback="onupdate"
                    :isMe="isMe")

                  comment-reply(v-if="comment.type =='reply'"
                    :comment="comment"
                    :isMe="isMe"
                    :whitelisted-files="whitelistedFiles"
                    :clickHandler="gotoComment"
                    :onClickImage="onClickImage"
                    :callback="onupdate")

                  comment-render(:text="comment.message" v-if="!comment.isAttachment(comment.message) && comment.type=='text'")

                //- CommentType: "file_attachment"
                file-attachment(v-if="comment.type == 'file_attachment'"
                  :comment="comment"
                  :whitelisted-files="whitelistedFiles"
                  :on-click-image="onClickImage"
                  :callback="onupdate"
                  :isMe="isMe")

                //- CommentCustom: "sticker"
                div(class="comment-sticker" v-if="comment.type == 'text' && isSticker")
                  image-loader(v-if="isSticker"
                    :comment="comment"
                    :message="comment.message.replace('[sticker]','[file]').replace('[/sticker]','[/file]')"
                    :whitelisted-files="whitelistedFiles"
                    :callback="onupdate"
                    :isMe="isMe")

                //- CommentType: "location"
                static-map(:lat="comment.payload.latitude"
                  :lng="comment.payload.longitude"
                  :name="comment.payload.name"
                  :mapkey="core.googleMapKey"
                  :message="comment.message"
                  :mapurl="comment.payload.map_url"
                  v-if="comment.type == 'location'")

                span(class="qcw-comment__time qcw-comment__time--children hidden-sm"
                  v-if="!isParent"
                  :class="{'qcw-comment__time--attachment': comment.isAttachment(comment.message)}") {{comment.time}}

                span(class="qcw-comment__time hidden-sm"
                  :class="{'qcw-comment__time--me': isMe}"
                  v-if="!isMe"
                  :style="messageTimeStyle") {{comment.time}}

                span(class="qcw-comment__time hidden-sm" v-else) {{comment.time}}

            div(v-else style="width: 100%;")
              //- CommentType: "location"
              static-map(:lat="comment.payload.latitude"
                :lng="comment.payload.longitude"
                :name="comment.payload.name"
                :mapkey="core.googleMapKey"
                :message="comment.message"
                :mapurl="comment.payload.map_url"
                v-if="comment.type == 'location'")

              //- CommentType: "contact_person"
              comment-contact(v-if="comment.type == 'contact_person'"
                :comment="comment")

              //- CommentType: "file_attachment"
              file-attachment(v-if="comment.type == 'file_attachment'"
                :comment="comment"
                :whitelisted-files="whitelistedFiles"
                :on-click-image="onClickImage"
                :callback="onupdate"
                :isMe="isMe")

              //- CommentType: "CAROUSEL"
              comment-carousel(:cards="comment.payload.cards" :mode="this.core.mode" v-if="comment.type === 'carousel'")

              //- CommentType: "CUSTOM"
              comment-custom(v-if="comment.type === 'custom' && comment.payload.type !== 'quickreply' && (comment.payload && comment.payload.type !== 'email_attachment')" :data="comment")

              //- comment CommentEmailAttachment
              comment-email-attachment(v-if="comment.type === 'custom' && (comment.payload && comment.payload.type === 'email_attachment')" :comment="comment" :isMe="isMe")

              //- CommentType: "BUTTON"
              div(v-if="comment.type == 'buttons'" class="button-message" :class="{'button-message__redownload': isRedownloadButton}")
                div
                  div(class="qcw-comment__content" :class="{'qcw-comment__content__redownload': isRedownloadButton}" v-html="comment.payload.text || comment.message")
                  comment-buttons(:buttons="comment.payload.buttons" :postbackHandler="postbackSubmit")
                  div(v-if="isRedownloadButton" class="qcw-comment__note")
                    i
                      icon(name="ic-info")
                    small You can only redownload an attachment file once

              //- CommentType: "BOT REPLY QUICK REPLY"
              div(v-if="comment.type === 'custom' && comment.payload.type === 'quickreply'" class="button-message")
                div
                  div(class="qcw-comment__content" v-html="comment.payload.text || comment.message")
                  comment-button-quick-reply(:content="comment.payload.content" :postbackHandler="postbackSubmit")

              //- CommentType: "CARD"
              comment-card(:data="comment.payload" v-if="comment.type==='card'")

              //- CommentType: "CARD"
              div(v-if="comment.type=='button_postback_response'" class="comment-text" @click.self="menuMoreClicked(null)")
                comment-render(:text="comment.message" v-if="!comment.isAttachment(comment.message) && !isRedownloadComment")
                comment-redownload(:message="comment.message+' File from '" :sender="comment.payload.payload.sender" :timestamp="comment.payload.payload.timestamp" v-if="isRedownloadComment")

              //- CommentType: "ACCOUNT_LINKING"
              div(v-if="comment.type == 'account_linking'")
                comment-render(:text="comment.payload.text || message")
                div(class="qcw-comment__buttons")
                  div(class="action_buttons")
                    button(@click="openAccountBox") {{ comment.payload.params.button_text }} &rang;

              //- CommentCustom: "sticker"
              div(class="comment-sticker" v-if="comment.type == 'text' && isSticker")
                image-loader(v-if="isSticker"
                  :comment="comment"
                  :message="comment.message.replace('[sticker]','[file]').replace('[/sticker]','[/file]')"
                  :whitelisted-files="whitelistedFiles"
                  :callback="onupdate"
                  :isMe="isMe")

              //- Interactive List Message
              div(v-if="isInteractiveListMessage" class="comment-text")
                div(v-if="!comment.isAttachment(comment.message) && comment.extras" class="qcw-comment__content")
                  div(v-if="comment.extras.header" class="qcw-interactive__header" v-html="comment.extras.header.value")
                  div(v-if="comment.extras.body" class="qcw-interactive__body" v-html="comment.extras.body")
                  div(v-if="comment.extras.footer && comment.extras.footer.text" class="qcw-interactive__footer" v-html="comment.extras.footer.text")
                  div(v-if="comment.extras.action && comment.extras.action.button" class="qcw-interactive__btn" v-html="comment.extras.action.button")
                  //- Selectable rows only when the host opts in (the WA -> Live Chat
                  //- handover room passes options.interactiveListReply). Every other
                  //- widget keeps the read-only list below, as in 3.2.9.
                  div(v-if="interactiveListReply && comment.extras.action && comment.extras.action.sections && comment.extras.action.sections.length" class="qcw-interactive__list")
                    div(v-for="(section, index) in comment.extras.action.sections" :key="index" class="qcw-interactive__section")
                      div(v-if="section.title" v-html="section.title" class="qcw-interactive__section-title")
                      button(v-for="row in section.rows" :key="row.id"
                        type="button"
                        class="qcw-interactive__item"
                        :disabled="isMe"
                        @click="listRowSubmit(row)")
                        div(v-if="row.title" v-html="row.title" class="qcw-interactive__item-title")
                        div(v-if="row.description" v-html="row.description" class="qcw-interactive__description")
                  template(v-else-if="comment.extras.action && comment.extras.action.sections && comment.extras.action.sections.length > 0")
                    ul(v-for="(section, index) in comment.extras.action.sections" :key="index" class="qcw-interactive__section")
                      li(v-if="section.title" v-html="section.title" class="qcw-interactive__row--title qcw-interactive__bulleted--item")
                      div(v-if="section.rows.length > 0" v-for="row in section.rows" :key="row.id")
                        li(v-if="row.title" v-html="`(${row.title})`" class="qcw-interactive__row--title" :class="{'qcw-interactive__bulleted--item' : !section.title}")
                        li(v-if="row.description" v-html="row.description")

              //- Interactive Quick Reply
              div(v-if="isInteractiveQuickReply" class="comment-text")
                div(v-if="comment.extras" class="qcw-comment__content")
                  file-attachment(v-if="comment.extras.header && comment.extras.header.type !== 'text'"
                    :comment="comment"
                    :whitelisted-files="whitelistedFiles"
                    :on-click-image="onClickImage"
                    :callback="onupdate"
                    :isMe="isMe")
                  div(v-if="comment.extras.header && comment.extras.header.type === 'text'" class="qcw-interactive__header" v-html="comment.extras.header.value")
                  div(v-if="comment.extras.body" class="qcw-interactive__body" v-html="comment.extras.body")
                  div(v-if="comment.extras.footer && comment.extras.footer.text" class="qcw-interactive__footer" v-html="comment.extras.footer.text")
                  div(v-if="comment.extras.action && comment.extras.action.buttons.length > 0" v-for="button in comment.extras.action.buttons" :key="button.reply.id" class="qcw-interactive__btn--item")
                    div(class="qcw-interactive__btn--reply" v-html="button.reply.title")

              //- Media timeout
              div(v-if="isMediaTimeout" class="comment-text" style="max-width: 400px;")
                div(v-html="mediaTimeoutText" class="qcw-comment__content")
                div(style="display: flex; justify-content: center; margin-top: 16px;")
                  button(class="qcw-download-file-button" @click="onRedownloadMedia(comment)")
                    icon(name="ic-download-borderless" :fill="messageStatusIconStyle")
                    span() Download File

              //- Interactive Voice Call
              div(v-if="isInteractiveVoiceCall" class="comment-text")
                div(v-if="!comment.isAttachment(comment.message) && comment.extras" class="qcw-comment__content")
                  div(v-if="comment.extras.body" class="qcw-interactive__body" v-html="comment.extras.body")
                  hr(style="margin: 10px 0;border: 1px solid #FFFFFF;")
                  div(v-if="comment.extras.action && comment.extras.action.parameters" class="qcw-interactive__btn-call")
                    icon(name="ic-call")
                    span(v-html="comment.extras.action.parameters.display_text")

              //- Interactive Call Permission Request
              .comment-text(v-if="isInteractiveCallPermissionRequest")
                .qcw-comment__content(v-if="!comment.isAttachment(comment.message) && comment.extras" v-html='`Can Business call you in the next 7 days?` + (comment.message == "Business Call Request" || comment.message == "" ? "" : ` \n \n ${comment.message}`)')

              //- Outgoing Call Textcomment.message
              .qcw-call__outgoing(v-if="isOutgoingCall")
                icon(name="ic-phone-outgoing-call")
                div(style="display: flex; flex-direction: column; gap: 4px;")
                  span(v-html="comment.extras.referral.call.content.header" style="font-weight: 600; font-size: 14px;")
                  span(v-html="comment.extras.referral.call.content.body" style="font-size: 12px;")

              //- Contact / Phone Number Card (contact_request)
              .qcw-contact-card(v-if="isContactCard")
                .qcw-contact-card__text This customer send you a phone number card
                .qcw-contact-card__item
                  icon(name="ic-user-circle")
                  span(v-html="contactCardName")

              //- Interactive CTA URL
              //- .comment-text(v-if="isInteractiveCtaUrl")
              //-   .qcw-comment__content
              //-     file-attachment(v-if="comment.extras.header && comment.extras.header.type !== 'text'"
              //-       :comment="comment"
              //-       :whitelisted-files="whitelistedFiles"
              //-       :on-click-image="onClickImage"
              //-       :callback="onupdate"
              //-       :isMe="isMe"
              //-       style="margin-bottom: 10px;")
              //-     .qcw-interactive__header(v-if="comment.extras.header && comment.extras.header.type === 'text'" v-html="comment.extras.header.value")
              //-     .qcw-interactive__body(v-if="comment.extras.body" v-html="comment.extras.body")
              //-     .qcw-interactive__footer(v-if="comment.extras.footer && comment.extras.footer.text" v-html="comment.extras.footer.text")
              //-     .qcw-interactive__btn-cta_url(v-if="comment.extras.action && comment.extras.action.parameters")
              //-       icon(name="ic-url" fill="#FFFFFF")
              //-       span(v-text="comment.extras.action.parameters.display_text")

               div(v-else-if="isMessageFlowInteractive" style="width: 100%;")

              //- comment-cta-interactive(
              //-   :comment="comment"
              //-   :whitelisted-files="whitelistedFiles"
              //-   :on-click-image="onClickImage"
              //-   :callback="onupdate"
              //-   :isMe="isMe")


              //- CommentType: "TEXT"
              .comment-text( v-if="(comment.type == 'text' || comment.type == 'reply') && !isInteractiveListMessage && !isInteractiveQuickReply && !isMediaTimeout && !isPreviousSessionMessageNotifier && !isInteractiveVoiceCall && !isInteractiveCallPermissionRequest && !isOutgoingCall && !isContactCard && !isInteractiveCtaUrl")
                file-attachment(v-if="comment.isAttachment(comment.message) && comment.type != 'reply'"
                  :comment="comment"
                  :whitelisted-files="whitelistedFiles"
                  :on-click-image="onClickImage"
                  :callback="onupdate"
                  :isMe="isMe")
                //- image-loader(v-if="comment.isAttachment(comment.message) && comment.type != 'reply'"
                //-   :comment="comment"
                //-   :message="comment.message"
                //-   :whitelisted-files="whitelistedFiles"
                //-   :on-click-image="onClickImage"
                //-   :callback="onupdate"
                //-   :isMe="isMe")

                //- Handle Replied message
                div(v-if="comment.extras.hasOwnProperty('replied_msg')"
                  class="reply-wrapper"
                  :class="{'reply-wrapper--me': isMe}"
                  style="cursor: default;")
                    div(class="reply-sender") {{ comment.payload.replied_comment_sender_username }}
                    div(class="reply-caption-container")
                      image-loader(v-if="comment.extras.replied_msg.type === 'file_attachment'"
                        :comment="comment"
                        :message="comment.extras.replied_msg.message"
                        :thumbnailMode="true"
                        :whitelisted-files="whitelistedFiles"
                        :on-click-image="onClickImage"
                        :callback="onupdate"
                        :is-comment-reply="false"
                        :isMe="isMe")
                      comment-render(v-if="comment.extras.replied_msg.type === 'text'" :text="comment.extras.replied_msg.message")

                comment-reply(v-if="comment.type =='reply'"
                  :comment="comment"
                  :isMe="isMe"
                  :whitelisted-files="whitelistedFiles"
                  :clickHandler="gotoComment"
                  :onClickImage="onClickImage"
                  :callback="onupdate")

                comment-catalog(:catalog="comment.extras.action" v-if="comment.extras.action && comment.extras.action.catalog_id")

                comment-interactive(:interactive="comment.extras.interactive" v-if="comment.extras.interactive && comment.extras.interactive.catalog_id")

                comment-render(
                  :comment="comment"
                  :text="comment.message"
                  v-if="!comment.isAttachment(comment.message) && comment.type=='text' && !isSticker && !isFlowResponse()"
                  :class="{'comment-text__interactive': comment.extras.interactive}")

                comment-order(:order="comment.extras.order" v-if="comment.extras.order && comment.extras.order.catalog_id")

                //- flow response bubble
                template(v-if="isFlowResponse()")
                  comment-flow-response(:comment="comment", :core="core")
                //- end of flow response bubble

              div(class="comment-text" v-if="comment.type == 'text' && isPreviousSessionMessageNotifier")
                image-loader(v-if="comment.isAttachment(comment.message)"
                  :comment="comment"
                  :message="comment.message"
                  :whitelisted-files="whitelistedFiles"
                  :on-click-image="onClickImage"
                  :callback="onupdate"
                  :isMe="isMe")
                comment-render(:text="comment.message" v-if="!comment.isAttachment(comment.message)")

              span(v-if="isInboxMode")
                span(class="qcw-comment__time qcw-comment__time--children"
                  v-if="!isParent"
                  :class="{'qcw-comment__time--attachment': comment.isAttachment(comment.message)}") {{comment.time}}

                span(class="qcw-comment__time"
                  :class="{'qcw-comment__time--me': isMe}"
                  v-if="!isMe"
                  :style="messageTimeStyle") {{comment.time}}

                span(class="qcw-comment__time" v-else) {{comment.time}}

              //- State
              div(v-if="isMe")
                div(class="qcw-comment__state qcw-comment__state--sending" v-if="comment.isPending")
                  icon(name="ic-load" class="ic-load__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state" v-if="!comment.isChannel && comment.isSent && !comment.isDelivered")
                  icon(name="ic-check" class="ic-check__state" :fill="messageStatusIconStyle")
                //- div(@click="resend(comment)" class="qcw-comment__state qcw-comment__state--failed"
                //-   v-if="comment.isFailed" :style="messageFailedIconStyle")
                //-   icon(name="ic-warning-circle" class="ic-failed__state")
                div(class="qcw-comment__state qcw-comment__state--delivered" v-if="!comment.isChannel && comment.status=='delivered'")
                   icon(name="ic-double-check" class="ic-double-check__state" :fill="messageStatusIconStyle")
                div(class="qcw-comment__state qcw-comment__state--read" v-if="!comment.isChannel && comment.status=='read'")
                   icon(name="ic-double-check" class="ic-double-check__state")
          div(@click="resend(comment)" class="qcw-comment__state--failed" v-if="comment.isFailed && isMe" :style="messageFailedIconStyle")
            icon(name="ic-warning-circle" class="ic-failed__state")


    div(v-if="comment.extras.cards" class="qcw-comment-container" :class="{'comment--me': isMe, 'comment--last': isLast}")
      div(class="qcw-comment-container_carousel" :class="{'comment--me' : isMe}")
        avatar(:src="commentAvatar(avatar)" :class="{'qcw-avatar--hide': true}")
        comment-wa-carousel(:comment="comment" :id="comment.id" :whitelisted-files="whitelistedFiles" :message-style="{marginBottom: '4px', backgroundColor: '#ffffff'}")

    div(v-if="comment.extras.is_echo" class="qcw-comment-container" :class="{'comment--me': isMe, 'comment--last': isLast}")
      div(class="qcw-comment-container_echo" :class="{'comment--me' : isMe}")
        comment-echo-source-label(:channel="roomChannel")

    div(v-if="isBroadcastMessage && broadcasterName" class="qcw-comment-container" :class="{'comment--me': isMe, 'comment--last': isLast}")
      div(class="qcw-comment-container_echo" :class="{'comment--me' : isMe}")
        comment-broadcast-sender(:broadcaster-name="broadcasterName" :broadcaster-role="broadcasterRole" :broadcasted-at="broadcastedAt")

    div(class="failed-info" v-if="comment.isFailed"
      :class="{ 'failed--last': isLast }") Message failed to send.
      span(@click="resend(comment)" class="" v-if="comment.isFailed" :class="{'resend--inbox': isInboxMode}") Resend

</template>

<script>
import Mime from "mime-types";
import QiscusCore from "../lib/SDKCore";
import { attachmentUrl, attachmentCaption } from '../lib/attachmentTag';
import { scrollListToElement } from '../lib/utils';
import Avatar from "./Avatar";
import Icon from "./Icon";
import StaticMap from "./StaticMap";
import ImageLoader from "./ImageLoader";
import FileAttachment from "./FileAttachment";
import CommentRender from "./CommentRender";
import CommentRedownload from "./CommentRedownload";
import CommentReply from "./CommentReply";
import CommentCustom from "./CommentCustom";
import CommentCarousel from "./CommentCarousel";
import CommentCard from "./CommentCard";
import CommentButtons from "./CommentButtons";
import CommentButtonQuickReply from "./CommentButtonQuickReply.vue";
import CommentContact from "./CommentContact";
import CommentEmailAttachment from "./CommentEmailAttachment";
import CommentFbAds from "./CommentFbAds";
import CommentTiktokAds from "./CommentTiktokAds.vue";
import clickOutside from "../lib/clickOutside";
import CommentOrder from "./CommentOrder";
import CommentCatalog from "./CommentCatalog";
import CommentInteractive from "./CommentInteractive";
import CommentWaCarousel from "./CommentWaCarousel.vue";
import CommentEchoSourceLabel from "./CommentEchoSourceLabel.vue";
import CommentBroadcastSender from "./CommentBroadcastSender.vue";
import CommentFlowResponse from "./CommentFlowResponse.vue";
import CommentBroadcastButton from "./CommentBroadcastButton.vue";
import CommentFlowInteractive from "./CommentFlowInteractive.vue";
import CommentCtaInteractive from "./CommentCtaInteractive.vue";
import CommentRequestContact from "./CommentRequestContact.vue";
import {
  maskSystemEventAgentName,
  renderSystemEventHtml,
} from "../helpers/systemEventMask";

/**
 * Extract the effective email for a comment, accounting for alternate_user overrides.
 */
function getEffectiveEmail(comment) {
  if (
    comment.extras &&
    comment.extras.alternate_user &&
    ('email' in comment.extras.alternate_user) &&
    comment.extras.alternate_user.email
  ) {
    return comment.extras.alternate_user.email.toString();
  }
  return ('username_real' in comment) && comment.username_real
    ? comment.username_real.toString()
    : '';
}

export default {
  name: 'Comment',
  components: {
    Avatar,
    Icon,
    StaticMap,
    ImageLoader,
    FileAttachment,
    CommentRender,
    CommentRedownload,
    CommentReply,
    CommentCustom,
    CommentCarousel,
    CommentCard,
    CommentButtons,
    CommentButtonQuickReply,
    CommentContact,
    CommentOrder,
    CommentCatalog,
    CommentInteractive,
    CommentEmailAttachment,
    CommentFbAds,
    CommentWaCarousel,
    CommentTiktokAds,
    CommentEchoSourceLabel,
    CommentBroadcastSender,
    CommentFlowResponse,
    CommentBroadcastButton,
    CommentFlowInteractive,
    CommentCtaInteractive,
    CommentRequestContact
  },
  props: [
    "comment",
    "commentBefore",
    "commentAfter",
    "userData",
    "onClickImage",
    "onupdate",
    "replyHandler",
    "showAvatar",
    "currentMenuId",
    "isSticker",
    "roomName",
    "stickerUrl",
    "customerEmail",
    "isInteractiveListMessage",
    "isInteractiveQuickReply",
    "isInteractiveVoiceCall",
    "isInteractiveCallPermissionRequest",
    "isOutgoingCall",
    "isContactCard",
    "isInteractiveCtaUrl"
  ],
  directives: { clickOutside },
  computed: {
    // Opt-in: rows of a WA interactive list become buttons that send a
    // `list_reply`. Off unless the host passes options.interactiveListReply.
    interactiveListReply() {
      const options = this.core && this.core.options;
      return !!(options && options.interactiveListReply);
    },
    /**
     * System-event text to display. When the tenant enables
     * `hideSystemEventAgentName` (set on QiscusUI/core.UI by the host),
     * agent names in join/handover events are masked to `an agent`. The
     * helper no-ops for other events, so this is safe to always compute.
     */
    systemEventMessage() {
      const msg = this.comment.message;
      return this.core.UI && this.core.UI.hideSystemEventAgentName
        ? maskSystemEventAgentName(msg)
        : msg;
    },
    /**
     * HTML for the system-event bubble: same `<timestamp> - <message>` string
     * as before (agent-name masking already applied via systemEventMessage),
     * but with http(s) URLs turned into clickable links. Escaped before
     * linkify, so binding it with v-html is safe.
     */
    systemEventHtml() {
      const raw = this.unsanitizeHTML(`${this.timestamp} - ${this.systemEventMessage}`);
      return renderSystemEventHtml(raw);
    },
    /**
     * Masked comment object for the custom-template path (`comment-custom`).
     * Custom templates substitute `{message}` from the raw comment, so without
     * this the agent name would still leak in the customer widget. Returns the
     * original object untouched when nothing is masked.
     */
    systemEventComment() {
      const masked = this.systemEventMessage;
      return masked === this.comment.message
        ? this.comment
        : { ...this.comment, message: masked };
    },
    timestamp() {
      const date = new Date(this.comment.timestamp);
      const h = String(date.getHours()).padStart('2', '0');
      const m = String(date.getMinutes()).padStart('2', '0');
      const s = String(date.getSeconds()).padStart('2', '0');

      return `${h}:${m}:${s}`;
    },
    isRedownloadComment() {
      return (
        this.comment.payload &&
        this.comment.payload.payload &&
        this.comment.payload.payload.sub_type === 'redownload'
      );
    },
    isRedownloadButton() {
      if (
        this.comment.type === 'buttons' &&
        this.comment.payload.buttons &&
        this.comment.payload.buttons.length > 0
      ) {
        const payload = this.comment.payload.buttons[0].payload.payload;
        if (payload) return payload.sub_type === 'redownload';
      }
      return false;
    },
    contactCardName() {
      const extras = this.comment.extras || {};
      // Contact card can arrive under either `referral` or `wa_contact`.
      const source = extras.wa_contact || extras.referral || {};
      if (source.name && source.name.formatted_name) {
        return source.name.formatted_name;
      }
      if (source.phones && source.phones.length > 0) {
        return source.phones[0].phone;
      }
      return "";
    },
    isChannel() {
      return this.comment.isChannel;
    },
    isDeleted() {
      return this.comment.is_deleted === true;
    },
    isCustomBuble() {
      return this.comment.type === 'card';
    },
    showDate() {
      return (
        this.commentBefore === null ||
        this.commentBefore.date !== this.comment.date
      );
    },
    addExtraMargin() {
      if (this.commentBefore === null) return false;
      return getEffectiveEmail(this.commentBefore) === getEffectiveEmail(this.comment);
    },
    isPreviousSessionMessageNotifier() {
      const textToFind = 'This message was sent on previous session by';
      let placeToFind = this.comment.message;
      if (
        this.comment.type === 'file_attachment' &&
        this.comment.payload.caption
      ) {
        placeToFind = this.comment.payload.caption;
      }
      return placeToFind.includes(textToFind);
    },
    isParent() {
      if (this.commentBefore === null) return true;
      return getEffectiveEmail(this.commentBefore) !== getEffectiveEmail(this.comment);
    },
    isGroupRoom() {
      return this.core.selected.room_type === 'group';
    },
    isMid() {
      if (this.commentAfter === null) return false;
      return !this.isParent
        && getEffectiveEmail(this.commentAfter) === getEffectiveEmail(this.comment);
    },
    isLast() {
      if (this.commentAfter === null) return true;
      return getEffectiveEmail(this.commentAfter) !== getEffectiveEmail(this.comment);
    },
    isMe() {
      const usernameReal = getEffectiveEmail(this.comment);

      let userDataEmail = ('email' in this.userData) && this.userData.email
        ? this.userData.email.toString()
        : '';

      if (this.core.UI.alternateUser) {
        userDataEmail = ('email' in this.core.UI.alternateUser) && this.core.UI.alternateUser.email
          ? this.core.UI.alternateUser.email.toString()
          : '';
      }

      return usernameReal === userDataEmail;
    },
    isCustomer() {
      return (
        (typeof this.comment.user_extras === "undefined" ||
          typeof this.comment.user_extras.type === "undefined" ||
          this.comment.user_extras.type !== "agent") &&
        !(this.comment.extras.action && this.comment.extras.action == "bot_reply")
      );
    },
    showMenuMore() {
      if (!this.currentMenuId) return false;
      return this.comment.id === this.currentMenuId;
    },
    isReplayBot() {
      return (
        this.comment.extras &&
        Object.keys(this.comment.extras).length > 0 &&
        this.comment.extras.action === 'bot_reply'
      );
    },
    username() {
      if (this.comment.extras && this.comment.extras.alternate_user) {
        return ('name' in this.comment.extras.alternate_user)
          ? this.comment.extras.alternate_user.name.toString()
          : '';
      }
      return this.comment.username_as;
    },
    avatar() {
      if (this.comment.extras && this.comment.extras.alternate_user) {
        return ('avatar' in this.comment.extras.alternate_user) && this.comment.extras.alternate_user.avatar
          ? this.comment.extras.alternate_user.avatar.toString()
          : '';
      }
      return this.comment.avatar;
    },
    isFbAdsComment() {
      return (
        this.comment.extras &&
        this.comment.extras.referral &&
        this.comment.extras.referral.source_type &&
        (this.comment.extras.referral.source_type === 'ad' ||
          this.comment.extras.referral.source_type === 'post')
      );
    },
    isTiktokAdsComment() {
      return (
        this.comment.extras &&
        this.comment.extras.referral &&
        this.comment.extras.referral.source &&
        this.comment.extras.referral.source === 'ad' &&
        this.comment.extras.referral.ad &&
        this.comment.extras.referral.ad.ad_id
      );
    },
    isMessageButtonBc() {
      return (
        this.comment.extras &&
        this.comment.extras.broadcast_message &&
        this.comment.extras.broadcast_message.is_broadcast &&
        this.comment.type === 'text' &&
        !this.comment.extras.is_carousel
      );
    },
    isRequestContactButton() {
      return (
        this.comment.extras &&
        this.comment.extras.sub_type === "request_contact_info" &&
        this.comment.extras.type === "interactive_wa"
      );
    },
    isBroadcastMessage() {
      return !!(
        this.comment.extras &&
        this.comment.extras.broadcast_message &&
        this.comment.extras.broadcast_message.is_broadcast
      );
    },
    broadcasterName() {
      const bm = this.comment.extras && this.comment.extras.broadcast_message;
      if (bm && bm.broadcaster && bm.broadcaster.name) {
        return bm.broadcaster.name;
      }
      return '';
    },
    broadcasterRole() {
      const bm = this.comment.extras && this.comment.extras.broadcast_message;
      const type = bm && bm.broadcaster && bm.broadcaster.type;
      // user.type from qismo-api: 1=admin, 2=agent, 3=supervisor
      const roles = { 1: 'Admin', 2: 'Agent', 3: 'SPV' };
      return roles[type] || '';
    },
    // Actual broadcast send time (extras.broadcast_message.sent_at) as a Date, or null.
    // The SDK comment for a broadcast is injected at reply time, so its timestamp
    // reflects the reply, not the send; sent_at carries the real send time.
    broadcastSentAtDate() {
      const bm = this.comment.extras && this.comment.extras.broadcast_message;
      if (this.isBroadcastMessage && bm && bm.sent_at) {
        const d = new Date(bm.sent_at);
        if (!Number.isNaN(d.getTime())) return d;
      }
      return null;
    },
    // "Sent at" line under the broadcaster label, formatted "DD MMM YYYY, HH.mm"
    // from the real send time. Empty when sent_at is unavailable.
    broadcastedAt() {
      const d = this.broadcastSentAtDate;
      if (!d) return '';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dd = String(d.getDate()).padStart(2, '0');
      const mmm = months[d.getMonth()];
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd} ${mmm} ${yyyy}, ${hh}.${min}`;
    },
    isMessageFlowInteractive() {
      return (
        this.comment.extras &&
        this.comment.type === 'text' &&
        this.comment.extras.sub_type === 'flow' &&
        this.comment.extras.type === 'interactive_wa'
      );
    },
    isStickerAds() {
      return this.isSticker && this.isFbAdsComment;
    },
    isCarousel() {
      return this.comment.extras && this.comment.extras.is_carousel;
    },
    whitelistedFiles() {
      if (
        this.core.UI.whitelistedFiles &&
        this.core.UI.whitelistedFiles !== ''
      ) {
        return this.core.UI.whitelistedFiles.split(',');
      }
      return [];
    },
    roomChannel() {
      if (!this.core.selected || !("options" in this.core.selected)) return "";
      try {
        const opts = this.core.selected.options
          ? JSON.parse(this.core.selected.options)
          : {};
        return opts.channel || "";
      } catch (e) {
        return "";
      }
    },
    isMediaTimeout() {
      if (!this.core.selected || !('options' in this.core.selected)) { return false; }
      const check = this.core.selected.options
        ? JSON.parse(this.core.selected.options)
        : {};
      const isWaChannel =
        Object.keys(check).length > 0
          ? check.channel.toLowerCase().includes('wa')
          : false;

      return (
        isWaChannel &&
        this.comment.extras &&
        this.comment.extras.media_id &&
        this.comment.message
          .toLowerCase()
          .includes(
            'the message sent by the customer cannot be rendered because it has timeout',
          )
      );
    },
    mediaTimeoutText() {
      let desc = this.comment.message;
      const newDesc = desc.split('because');

      newDesc[1] =
        'due to a timeout. However, you can still download the file by clicking the download button.';
      desc = newDesc.join('');
      return desc;
    },
    isMeFileImageAttachment() {
      const payload = this.comment.payload || {};
      // A caption also rides after the closing tag on a plain-text
      // `[file]url[/file] caption` send — that bubble keeps its background.
      const isCaptionEmpty =
        (!('caption' in payload) || payload.caption === '') &&
        attachmentCaption(this.comment.message) === '';
      return (
        this.isMe &&
        this.comment.message.match(/\.(jpg|jpeg|gif|png|webp|mov|mp4|webm)/i) != null &&
        isCaptionEmpty
      );
    },
    isInboxMode() {
      return this.core.UI.displayMode === 'inbox';
    },
    dateToday() {
      const inboxDateConfig = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };

      const liveChatDateConfig = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };

      const dateConfig = this.isInboxMode
        ? inboxDateConfig
        : liveChatDateConfig;

      return new Date(this.comment.date).toLocaleString('en-US', dateConfig);
    },
  },
  data() {
    return {
      messageStyle: {},
      tipMessageStyle: {},
      messageStatusIconStyle: { fill: QiscusUI.colors.messageStatusIconColor },
      messageFailedIconStyle: { fill: QiscusUI.colors.messageFailedIconColor },
      messageTimeStyle: { color: QiscusUI.colors.messageTimeColor },
      core: QiscusCore,
    };
  },
  mounted() {
    if (!this.isCustomBuble && !this.isMeFileImageAttachment) {
      this.messageStyle = {
        color: this.isMe
          ? this.core.UI.colors.bubleRightTextColor
          : this.core.UI.colors.bubleLeftTextColor,
        background: this.isMe
          ? this.core.UI.colors.bubleRightColor
          : this.core.UI.colors.bubleLeftColor,
      };
      this.tipMessageStyle = {
        borderLeftColor: this.isMe
          ? this.core.UI.colors.bubleRightColor
          : 'transparent',
        borderRightColor: this.isMe
          ? 'transparent'
          : this.core.UI.colors.bubleLeftColor,
      };
    }
  },
  methods: {
    renderPreviousSessionMessage(msg) {
      if (!msg.message.startsWith('[file]')) return msg.message;
      return `File Attachment: ${attachmentUrl(msg.message)}`;
    },
    sanitizeHTML(content) {
      return content
        ? content.replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        : content;
    },
    unsanitizeHTML(content) {
      return content
        ? content.replaceAll('&gt;', '>').replaceAll('&lt;', '<')
        : content;
    },
    onClickMenuOutside() {
      if (this.currentMenuId) this.menuMoreClicked(null);
    },
    gotoComment() {
      const commentId = this.comment.payload.replied_comment_id;
      const element = document.getElementById(commentId);
      let ofs = 0;
      let timer = 1;

      if (!element) {
        return this.$emit('commentNotFound', commentId);
      }

      const blink = globalThis.setInterval(() => {
        element.style.background = `rgba(255, 252, 218, ${Math.abs(
          Math.sin(ofs),
        )})`;
        ofs += 0.05;
        timer += 1;
        if (timer === 300) {
          globalThis.clearInterval(blink);
          element.style.background = 'transparent';
        }
      }, 10);

      return scrollListToElement(element);
    },
    resend(comment) {
      const commentToBeSent = Object.assign({}, comment);
      commentToBeSent.payload = JSON.stringify(commentToBeSent.payload);
      return this.core.resendComment(commentToBeSent).then(
        () => this.$toasted.success('Resending comment successful'),
        () => this.$toasted.error('Resending comment failed'),
      );
    },
    confirmDeleteComment(comment) {
      this.menuMoreClicked(null);
      const actions = [
        {
          text: 'Yes',
          onClick: () =>
            this.deleteComment(comment, true).then(
              () => this.$toasted.success('Message deleted'),
              () => this.$toasted.error('Failed deleting message'),
            ),
        },
        {
          text: 'Cancel',
          onClick: (e, toastObject) => toastObject.goAway(0),
        },
      ];
      return this.$toasted.show('Are you sure to delete this message?', {
        duration: 5000,
        action: actions,
      });
    },
    deleteComment(comment, isForEveryone) {
      this.$toasted.clear();
      if (comment.isFailed) return this.deleteLocalComment(comment);
      const roomId = this.core.selected.id;
      const commentIds = [comment.unique_id];
      const commentIndex = this.core.selected.comments.findIndex(
        c => comment.unique_id === c.unique_id,
      );
      if (commentIndex && comment.before_id < 1) {
        this.core.selected.comments[commentIndex + 1].before_id = 0;
      }
      return this.core.deleteComment(roomId, commentIds, isForEveryone, true);
    },
    deleteLocalComment(comment) {
      const comments = this.core.selected.comments;
      const commentToBeFound = comments.findIndex(
        com => com.unique_id === comment.unique_id,
      );
      if (commentToBeFound > -1) comments.splice(commentToBeFound, 1);
      return Promise.resolve(comments);
    },
    haveTemplate(comment) {
      if (!this.core.customTemplate) return false;
      return this.core.templateFunction(comment);
    },
    postbackSubmit(button) {
      const roomId = this.core.selected.id;
      const labelToSend = button.postback_text
        ? button.postback_text
        : button.label;
      const nanotimestamp =
        globalThis.performance.now() + globalThis.performance.timeOrigin;
      const uniqueId = `${roomId}_${nanotimestamp}`;
      this.core
        .sendComment(
          roomId,
          labelToSend,
          uniqueId,
          'button_postback_response',
          JSON.stringify(button.payload),
        )
        .then((res) => {
          this.core.options.sentMessageCallback(res);
        });
    },
    // WA interactive list row picked in the widget: send it the way qismo-api
    // stores a WhatsApp `list_reply` (text = row title, id in extras), so the
    // agent sees plain text and bots read the row id from the same place.
    listRowSubmit(row) {
      if (!this.interactiveListReply || this.isMe) return;
      const roomId = this.core.selected.id;
      const nanotimestamp =
        globalThis.performance.now() + globalThis.performance.timeOrigin;
      const uniqueId = `${roomId}_${nanotimestamp}`;
      const listReply = { id: row.id, title: row.title };
      if (row.description) listReply.description = row.description;
      this.core
        .sendComment(roomId, row.title, uniqueId, 'text', null, {
          sub_type: 'interactive',
          interactive: { type: 'list_reply', list_reply: listReply },
        })
        .then((res) => {
          const cb = this.core.options.sentMessageCallback;
          if (cb) cb(res);
        });
    },
    openAccountBox() {
      window.open(
        this.comment.payload.url,
        'AccountLinkingPopup',
        'width=500,height=400,location=no,menubar=no,resizable=1,status=no,toolbar=no',
      );
    },
    messageInfoHandler(comment) {
      this.core.UI.isMessageInfoActive = true;
      this.core.UI.messageInfoData = {
        comment,
      };
    },
    menuMoreClicked(id) {
      const commentId = this.currentMenuId === id ? null : id;
      this.$emit('onChangeMenu', commentId);
    },
    commentAvatar(avatar) {
      if (!avatar) return this.core.avatar_url;
      if (avatar.includes('//image.flaticon.com/icons')) {
        return 'https://multichannel.qiscus.com/img/default_avatar.svg';
      }
      return avatar;
    },
    onRedownloadMedia(data) {
      return new Promise((resolve, reject) => {
        const check = this.core.selected.options
          ? JSON.parse(this.core.selected.options)
          : {};
        const { _appUrl, _authToken } = globalThis.qenv;
        const url = `${_appUrl}/whatsapp/v1/${this.core.AppId}/${check.channel_id}/media/${data.extras.media_id}`;
        const xhr = new XMLHttpRequest();
        xhr.responseType = 'blob';

        xhr.open('GET', url, true);
        xhr.setRequestHeader('Authorization', _authToken);
        xhr.setRequestHeader('Qiscus-App-Id', this.core.AppId);
        xhr.setRequestHeader('Accept', 'application/json');

        xhr.addEventListener('error', () => {
          this.$toasted.error('Error download file');
          reject(new Error('Error download file'));
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const contentType = xhr.getResponseHeader('Content-Type');
            const blob = new Blob([xhr.response], { type: contentType });
            const extension = Mime.extension(contentType);
            const filename = `${data.extras.media_id}.${extension}`;
            const link = document.createElement('a');

            document.body.appendChild(link);
            link.href = globalThis.URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            link.remove();
            this.$toasted.success('File downloaded Successfully');
            resolve();
          } else {
            this.$toasted.error('Error download file');
            reject(new Error('Error download file'));
          }
        });

        xhr.send();
      });
    },
    isFlowResponse() {
      return (
        this.comment &&
        this.comment.extras &&
        this.comment.extras.interactive &&
        this.comment.extras.interactive.type === 'nfm_reply' &&
        this.comment.extras.interactive.nfm_reply.name === 'flow'
      );
    },
  },
};
</script>
