<template lang="pug">
  div.qcw-chat-wrapper
    div.qcw-main
      svg-icon

      image-modal(:comment="imageModalContent"
        :closeBtnHandler="closeImageModal"
        v-if="imageModalIsActive")

      comment-reply-preview(v-if="repliedComment && core.UI.config.showRepliedForm"
        :core="core"
        :comment="repliedComment"
        :closeReplyHandler="closeReply")

      upload-info(v-if="uploadedFiles.length > 0"
        :files="uploadedFiles")

      chat-header(v-if="core.selected && core.UI.config.showHeader"
        :core="core"
        @toggle-window="() => toggleWindowStatus()"
        @header-click="() => headerClickedHandler()"
        @back-to-channel="() => onBackToChannelIframe()")

      //- div(v-if="!core.selected" class="empty-state")
      //-   //- img(v-if="core.UI.emptyStateUrl" :src="core.UI.emptyStateUrl")
      //-   icon(v-if="core.UI.emptyStateUrl" name="ic-empty-state" style="width: 24px; height: 24px;")
      //-   div Loading ...

      attachment-form(
        :uploadHandler="uploadFile"
        :displaying="showAttachmentForm"
        v-if="showAttachmentForm"
        :attachmentData="attachmentData"
        :setAttachmentData="setAttachmentData"
        :closeFormHandler="toggleAttachmentForm"
      )

      file-drag-drop(
        :core="core"
        :dragging="dragging"
        @onDragging="onDragging"
        @onFileChange="onFileChange")

      transition(name="backdrop")
        upload-file-form(
          v-if="fileData"
          :core="core"
          :data="fileData"
          @handle-close="handleFileData"
          @handle-upload="handleUploadFile"
        )

      .qcw-upload-toast
        transition-group(name="fade")
          upload-image-toast(
            v-for="data in uploadData"
            :key="data.id"
            :core="core"
            :data="data"
                        @handle-close="handleUploadFile"
          )

      comment-list-email(
        v-if="isEmailMode"
        :core="core"
        :replyHandler="setReply"
        :onupdate="scrollToBottom")

      comment-list(
        v-else
        :core="core"
        :on-click-image="openImageModal"
        :repliedComment="repliedComment"
        :replyHandler="setReply"
        :onupdate="scrollToBottom"
        @onDragging="onDragging")

      assistant-result(:core="core"
        :menu="assistant.menu"
        :chatHistory="assistant.chatHistory"
        :assistantResult="assistant.result"
        :agentInput="assistant.agentInput" 
        :channelId="assistant.channel_id"
        @assistant-changes="assistantChanges"
        @assistant-apply="assistantApply"
        @assistant-result="assistantResultChange"
        :langs="assistant.langs")

      div.qcw-chat-end-error(v-if="customerEndChatFailed" role="alert") {{ $customerText('chat.endFailed') }}

      div.qcw-chat-ended(v-if="customerChatEnded") {{ $customerText('chat.ended') }}

      comment-form(:core="core"
        v-if="core.UI.config.showCommentForm && core.selected && !customerChatEnded"
        :repliedComment="repliedComment"
        :showAttachmentForm="showAttachmentForm"
        :toggleAttachmentForm="toggleAttachmentForm"
        :setAttachmentData="setAttachmentData"
        :closeReplyHandler="closeReply"
        :isEmailMode="isEmailMode"
        :isAssistant="assistant.show"
        :assistantResult="assistant.result"
        :currentMenu="assistant.menu"
        :assistantApply="assistant.apply"
        @assistant-apply="assistantApply"
        @assistant-enabled="assistantShowStatus"
        @assistant-changes="assistantChanges"
        @assistant-language="setLanguages")

    //- Start of message info
    message-info(v-if="core.UI.isMessageInfoActive" :core="core")
</template>

<script>
import SvgIcon from './SVGIcon';
import Icon from './Icon';
import CommentList from './CommentList';
import CommentForm from './CommentForm';
import CommentReplyPreview from './CommentReplyPreview';
import CommentListEmail from './CommentListEmail';
import { focusMessageForm, scrollIntoLastElement } from '../lib/utils';
import ImageModal from './ImageModal';
import UploadInfo from './UploadInfo';
import ChatHeader from './ChatHeader';
import FileDragDrop from './FileDragDrop';
import UploadFileForm from './UploadFileForm';
import UploadImageToast from './UploadImageToast';
import { uploadFile } from '../lib/fileUploader';
import AttachmentForm from './AttachmentForm';
import MessageInfo from './MessageInfo';
import AssistantResult from './ai-assistant/result';

export default {
  name: 'ChatWindow',
  props: ['core', 'toggleWindowStatus', 'onBackToChannelIframe'],
  components: {
    CommentList,
    SvgIcon,
    Icon,
    CommentForm,
    CommentReplyPreview,
    ImageModal,
    UploadInfo,
    ChatHeader,
    FileDragDrop,
    UploadFileForm,
    UploadImageToast,
    AttachmentForm,
    MessageInfo,
    CommentListEmail,
    AssistantResult,
  },
  data() {
    return {
      repliedComment: null,
      imageModalContent: null,
      imageModalIsActive: false,
      dragging: false,
      showAttachmentForm: false,
      attachmentData: {
        thumbnail: null,
        file: null,
      },
      assistant: {
        show: false,
        menu: null,
        chatHistory: null,
        result: '',
        apply: false,
        agentInput: '',
        channel_id: null,
        langs: [],
      },
      fileData: null,
      uploadData: [],
      uploadDataId: 0,
    };
  },
  computed: {
    // Opt-in (options.customerEndChat, set by the WA -> Live Chat handover
    // room only): after the customer ended the chat the composer is replaced
    // by a notice, so nothing more can be sent into a closed session.
    customerChatEnded() {
      const options = this.core.options;
      return !!(options && options.customerEndChat) &&
        this.core.UI.customerEndChatState === 'ended';
    },
    customerEndChatFailed() {
      const options = this.core.options;
      return !!(options && options.customerEndChat) &&
        this.core.UI.customerEndChatState === 'error';
    },
    showIsTypingStatus() {
      const self = this;
      if (this.core.isTypingStatus) {
        window.setTimeout(() => {
          self.core.isTypingStatus = '';
        }, 3000);
        return true;
      }
      return false;
    },
    uploadedFiles() {
      if (!this.core.selected) return [];
      return this.core.uploadedFiles.filter(
        f => f.roomId === this.core.selected.id,
      );
    },
    myReactiveColor() {
      if (this.core.isTypingStatus) {
        return this.core.UI.colors.statusTypingColor;
      } else if (
        this.core.chatmateStatus === 'Online' &&
        this.core.selected.room_type !== 'group'
      ) {
        return this.core.UI.colors.statusOnlineColor;
      }
      return this.core.UI.colors.statusOfflineColor;
    },
    participants() {
      const limit = 3;
      const overflowCount = this.core.selected.participants.length - limit;
      const participants = this.core.selected.participants
        .slice(0, limit)
        .map(item => item.username.split(' ')[0]);
      if (this.core.selected.participants.length <= limit)        { return participants.join(', '); }
      return participants.concat(this.$customerText('participants.others', { count: overflowCount })).join(', ');
    },
    isEmailMode() {
      if (!this.core.selected || !('options' in this.core.selected))        { return false; }
      const options = this.core.selected.options
        ? JSON.parse(this.core.selected.options)
        : {};
      const isEmailModeInit = window.qiscusUIEmailMode || false;
      if (Object.keys(options).length > 0) {
        const scalar = options.scalar ? JSON.parse(options.scalar) : {};
        if (Object.keys(scalar).length > 0) {
          return (
            this.core.mode === 'wide' &&
            scalar.channel === 'email' &&
            isEmailModeInit
          );
        }
        return false;
      }
      return false;
    },
  },
  watch: {
    'core.UI.config.showRepliedForm': {
      handler(newVal) {
        if (newVal !== null && !newVal) {
          this.repliedComment = null;
        }
      },
    },
  },
  methods: {
    assistantChanges(value) {
      this.assistant.agentInput = value.input;
      this.assistant.chatHistory = value.history;
      this.assistant.menu = value.menu;
      this.assistant.channel_id = value.channel_id;
    },
    assistantShowStatus(value) {
      this.assistant.show = value;
    },
    assistantApply(value) {
      this.assistant.apply = value;
    },
    assistantResultChange(value) {
      this.assistant.result = value;
      this.assistant.agentInput = value;
    },
    setAttachmentData(data) {
      this.attachmentData.file = data.file;
      this.attachmentData.thumbnail = data.thumbnail;
      this.showAttachmentForm = true;
    },
    toggleAttachmentForm() {
      this.showAttachmentForm = !this.showAttachmentForm;
      document.querySelectorAll(
        '.qcw-comment-form input[type=file]',
      )[1].value = null;
    },
    headerClickedHandler() {
      this.core.options.headerClickedCallback();
    },
    openImageModal(comment) {
      this.imageModalContent = comment;
      this.imageModalIsActive = true;
    },
    closeImageModal() {
      this.imageModalIsActive = false;
      this.imageModalContent = null;
    },
    setReply(comment) {
      if (!this.core.selected || !('options' in this.core.selected)) {
        return;
      }
      const options = this.core.selected.options
        ? JSON.parse(this.core.selected.options)
        : {};

      // check room wa or not
      if (
        Object.keys(options).length > 0 &&
        options.channel &&
        options.channel === 'wa'
      ) {
        // check comment has wa_wamid or not, if not call load_comments sdk
        if (
          comment.unique_temp_id &&
          comment.unique_temp_id.toLowerCase().includes('wa_wamid')
        ) {
          this.onSetReply(comment);
        } else {
          this.core
            .loadComments(this.core.selected.id, {
              last_comment_id: comment.id,
              after: true,
            })
            .then((res) => {
              const detail = res.find(item => item.id === comment.id);
              // eslint-disable-next-line no-param-reassign
              if (detail) comment.unique_temp_id = detail.unique_temp_id;

              const uniqArr = this.core.selected.comments.filter(
                (obj, index) => (
                    index ===
                    this.core.selected.comments.findIndex(o => obj.id === o.id)
                  ),
              );
              this.core.selected.comments = uniqArr;

              this.onSetReply(comment);
            })
            .catch(() => {
              this.onSetReply(comment);
            });
        }
      } else {
        this.onSetReply(comment);
      }
    },
    onSetReply(comment) {
      this.closeReply();
      this.repliedComment = comment;
      this.core.UI.config.showRepliedForm = true;
      // focus the textarea of commentform (skipped on touch screens, see utils)
      focusMessageForm();
    },
    closeReply() {
      this.repliedComment = null;
      this.core.UI.config.showRepliedForm = false;
    },
    scrollToBottom() {
      scrollIntoLastElement(this.core);
    },
    onDragging(status) {
      this.dragging = status;
    },
    uploadFile(file, caption) {
      // Same as `CommentForm.changeFile`: the attachment inherits the reply the
      // sender picked, and the composer's reply state is released before the
      // upload is handed off.
      const repliedComment = this.repliedComment || null;
      if (repliedComment) this.closeReply();
      uploadFile(
        file,
        caption,
        this.core,
        this.$toasted,
        null,
        repliedComment,
        this.$customerText('upload.fileFailed'),
      );
      this.showAttachmentForm = false;
    },
    setLanguages(value) {
      this.assistant.langs = value;
    },
    onFileChange(files) {
      this.fileData = files;
    },
    handleFileData(event) {
      if (event) {
        this.fileData = event.target.files;
      } else {
        this.fileData = null;
        if (this.$refs.inputFile) this.$refs.inputFile.value = null;
      }
    },
    handleUploadFile(data) {
      const uploadData = this.uploadData;
      if (data.id) {
        const i = uploadData.findIndex(d => d.id === data.id);
        uploadData.splice(i, 1);
      } else {
        this.uploadDataId += 1;
        // Snapshot the reply onto the batch and release it here, so the
        // composer stops showing a quote for images already on their way.
        const repliedComment = this.repliedComment || null;
        if (repliedComment) this.closeReply();
        uploadData.push({
          id: this.uploadDataId,
          data: data.file,
          repliedComment,
        });
      }
      this.handleFileData(null);
    },
  },
};
</script>

<style lang="stylus">
@import url('https://fonts.googleapis.com/css?family=Open+Sans:400,600')
@import '../assets/stylus/_variables.styl'

.qcw-chat-wrapper
  width 360px
  height 0
  display flex
  // box-shadow 0 7px 16px rgba(46,46,46,.15)
  border-radius 32px
  overflow hidden
  position absolute
  transition all .15s ease-in-out
  bottom 64px
  background-color $white
  .qcw-container.qcw-container--open &
    height 480px

    @media screen and (max-width: 600px)
      right 0
      bottom 0
      width 100vw
      height 100vh
      z-index 1
      border-radius 0

.qcw-main
  width 100%
  display flex
  flex-direction column
  position relative

.qcw-window-toggle-btn
  visibility hidden
  display none
  @media screen and (max-width: 400px)
    cursor pointer
    flex 0 0 32px
    align-items center
    justify-content flex-end
    display flex
    visibility visible
    svg
      margin-top 0

.qcw-header
  flex 0 0 73px
  background $white
  display flex
  align-items center
  padding 13px 16px
  border-bottom 0.5px solid $lightGrey
  gap: 12px;

  @media screen and (max-width: 600px)
    padding 32px
    border-bottom unset
  .qcw-header-avatar
    flex 0 0 48px
    display flex
    @media screen and (max-width: 600px)
      flex 0 0 32px
  .qcw-header-avatar img
    width 48px
    height 48px
    border-radius 50%

    @media screen and (max-width: 600px)
      width 32px
      height 32px
      margin-top 0
  .qcw-header-info
    flex 1
    color $dark
    .qcw-user-display-name
      font-size 15px
      font-weight 600
      @media screen and (max-width: 600px)
        font-size 14px
        font-weight 600
        line-height 16px
    .qcw-user-status
      font-size 13px
      white-space: nowrap;
      overflow: hidden;

      @media screen and (max-width: 600px)
        font-size 12px
        font-weight 400
        line-height 16px

.qcw-end-chat-btn
  flex 0 0 auto
  border 1px solid $lightGrey
  border-radius 16px
  background $white
  color $dark
  font-size 12px
  font-weight 600
  line-height 16px
  padding 6px 12px
  cursor pointer
  &:disabled
    opacity .6
    cursor default

.qcw-chat-ended,
.qcw-chat-end-error
  padding 16px
  text-align center
  font-size 14px
  background $white
  border-top 0.5px solid $lightGrey

.qcw-chat-end-error
  color $red

.qcw-comments
  flex 1
  overflow hidden
  overflow-y auto
  position relative

.qcw-comment-form
  flex 0 0 64px
  background #FFF
  border-top 0.5px solid $lightGrey

.qcw-avatar--hide
  visibility hidden

.reply-wrapper
  position relative
  padding 16px 8px
  background-color $darkWhite
  margin-bottom 8px
  border-radius 2px
  cursor pointer
  &.reply-wrapper--me
    background-color $darkerWhite;
  .reply-sender
    font-size 12px
    font-weight 400
    color $grey
  .qcw-comment__content
    font-size 14px
    color $dark
    font-weight 400
    line-height 20px
    overflow hidden
    overflow-y auto
    max-height 150px
    width auto
    white-space pre-line
    word-break break-word
  .image-loader--text
    color: #666
  &:before
    all unset
  // content ""
  // position: absolute
  // left 0px
  // top 0px
  // width 8px
  // height calc(100% - 0px)
  // background $brown
  // border-radius 2px 0 0 2px

  &.reply-wrapper--preview
    margin-bottom 0
    order 1
    width: calc(100% - 64px);
    background-color $white
    padding 16px 8px
    margin-inline 32px
    animation fadeInUp 0.3s ease-out
    // box-shadow 0 -8px 16px rgba(199,199,199,0.2)
    border-top 1px solid $lightGrey;
    &:before
      all unset

  &.reply-wrapper--redownload
    margin-top: 8px
    &:before
      background: #D9D9D9
    .qcw-comment__content
      max-height: unset

.reply-close-btn
  position absolute
  right 32px
  top 16px
  font-size 10px
  cursor pointer
  svg.qc-icon
    height 12px
    width 12px

.empty-state
    display flex
    flex-direction column
    align-items center
    justify-content center
    width 100%
    height 100%
    padding 30px
    background #FFF
    text-align center
    font-size 14px
</style>
