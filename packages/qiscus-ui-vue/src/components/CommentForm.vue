<template lang="pug">
  div(class="qcw-comment-form" :class="{ 'email-mode': isEmailMode }"
    :style="!isEmailMode ? 'background: transparent; border: 0;' : ''")

    div(v-if="!isEmailMode" class="box-form")
      div(class="input-form")
        textarea(placeholder="Send a message ..."
          rows="1"
          id="comment-input"
          :autofocus="!isTouchScreen"
          @paste="handlePaste"
          @keyup="typingHandler($event)"
          @focus="isIOSDevice && scheduleRevealMessageForm()"
          @keydown.enter="trySubmitComment($event)"
          :style="textareaStyle"
          :class="{ 'qcw-text-warning': !isMaxCountValid && (showTwitterWordCount || showCustomWordCount) }"
          v-model="commentInput")
        span(
          v-if="showTwitterWordCount || showCustomWordCount"
          :class="{ 'qcw-text-warning': !isMaxCountValid }"
          style="font-size: 10px; position: absolute; top: 25px; right: 25px;")
          | {{ maxCount - commentInput.length }}
      div(class="box-uploader")
        div(:class="{ 'hidden-sm': commentInput.length > 0 }" style="display: flex;")
          span(class='qcw-icon')
            label
              input(class="uploader__input" name="file_all" type="file" @change="handleFileData" ref="inputFile")
              icon(name="ic-new-file-attachment" :fill="core.UI.colors.formMessageIconColor")
          span(class='qcw-icon')
            label
              input(class="uploader__input" name="file_image" type="file" accept="image/*" multiple @change="handleImageData" ref="inputImage")
              icon(name="ic-new-image-attachment" :fill="core.UI.colors.formMessageIconColor")
          ads-tracker-toggle(:core="core" @show="showAdsConverter = true")
          assistant-menu(v-if="isAssistant" :core="core" :menu="currentMenu" @assistant-menu="assistantMenuChange" :langs="languages" @assistant-language="setLanguages" :assistant-result="assistantResult")
          div(id="quick-reply")
          div(id="predefined-button")
          div(id="agent-can-send-broadcast-inbox")
          div(id="agent-wa-call")

        span(
          @click="trySubmitComment($event)"
          :class="{ 'hidden-sm': commentInput.length == 0, 'qcw-send--sending': isSendingText, 'qcw-send--disabled': commentInput.trim().length === 0 }"
          :style="{ color: core.UI.colors.bubleRightColor }")
          icon(name="ic-new-send-message"
            style="margin-top: 0;"
            :style="showTwitterWordCount || showCustomWordCount ? inputMaxCount : inputCount")

    //- email mode
    .container-form-msg(v-if="isEmailMode")
      .input-form(:class="{ 'email-mode-input': isEmailMode }")
        WywygEditor(
          ref="emailEditor"
          :emailAttachments="emailAttachments"
          :core="core"
          @ondeleteAttachment="deleteAttachment"
          @onchange="onchangeEmailForm"
        )
          template(slot="additionalButton")
            button
              span(class='qcw-icon')
                label
                  input(class="uploader__input" name="email_file_all" type="file" multiple @change="setEmailAttachment")
                  icon(name="ic-file-attachment" :fill="core.UI.colors.formMessageIconColor" style="height: 20px; margin-top: 0px")
            button(class="btn-agent-copilot")
              assistant-menu(v-if="isAssistant" :core="core" :menu="currentMenu" @assistant-menu="assistantMenuChangeOnEmail" :langs="languages" :assistant-result="assistantResult")

    .email-form-footer(v-if="isEmailMode")
      .container-email-button
      .container-email-button
        span(
          v-if="cleanHtml(commentInput).length > 0 || emailAttachments.length > 0"
          class='qcw-icon' title="Clear all"
          style="cursor: pointer"
          @click="clearAllMessage()")
          icon(name="ic-trash" fill="#EF7D7C")
        button(
          class="send-button-email"
          :disabled="(cleanHtml(commentInput).length === 0 && emailAttachments.length === 0) || isSendingEmail"
          @click="sendEmailMessage") Send Now

    transition(name="backdrop")
      upload-image-form(
        v-if="imageData"
        :core="core"
        :data="imageData"
        @handle-close="handleImageData"
        @handle-upload="handleUploadData"
      )
      upload-file-form(
        v-if="fileData"
        :core="core"
        :data="fileData"
        @handle-close="handleFileData"
        @handle-upload="handleUploadFile"
      )

    ads-tracker-converter(
      v-if="showAdsConverter"
      :core="core"
      @handle-close="showAdsConverter = false"
    )


    .qcw-upload-toast
      transition-group(name="fade")
        upload-image-toast(
          v-for="data in uploadData"
          :key="data.id"
          :core="core"
          :data="data"
                    @handle-close="handleUploadData"
        )
</template>

<script>
import TurndownService from 'turndown';
import { uploadEmailAttachment } from '../lib/fileUploader';
import { withChannelReplyRef } from '../lib/replyPayload';
import {
  scrollIntoLastElement,
  calculateSizeInMB,
  debounce,
  focusMessageForm,
  isTouchDevice,
  isIOS,
  revealMessageForm,
} from '../lib/utils';
import Icon from './Icon';
import UploadFileForm from './UploadFileForm';
import UploadImageForm from './UploadImageForm';
import UploadImageToast from './UploadImageToast';
import WywygEditor from './WywygEditor';
import AssistantMenu from './ai-assistant/menu';
import AdsTrackerToggle from './ads-tracker/Toggle';
import AdsTrackerConverter from './ads-tracker/AdsTrackerConverter';

export default {
  name: 'CommentForm',
  components: {
    Icon,
    UploadFileForm,
    UploadImageForm,
    UploadImageToast,
    WywygEditor,
    AssistantMenu,
    AdsTrackerToggle,
    AdsTrackerConverter,
  },
  props: [
    'core',
    'repliedComment',
    'closeReplyHandler',
    'showAttachmentForm',
    'toggleAttachmentForm',
    'setAttachmentData',
    'isEmailMode',
    'isAssistant',
    'assistantApply',
    'assistantResult',
    'currentMenu',
  ],
  data() {
    return {
      commentInput: '',
      isTouchScreen: isTouchDevice(),
      isIOSDevice: isIOS(),
      excludedEmoji: ['flags', 'objects', 'recent'],
      emojiSize: 16,
      sheetSize: 16,
      toggleEmoji: false,
      textareaStyle: {},
      emojione: typeof emojione !== 'undefined' ? emojione : {},
      delayTyping: false,
      imageData: null,
      fileData: null,
      uploadData: [],
      uploadDataId: 0,
      maxCount: 280,
      emailAttachments: [],
      isSendingEmail: false,
      isSendingText: false,
      // Per-room record of the last text send { [roomId]: { text, at } }.
      // Content-based dedup guard: `isSendingText` only blocks while the
      // send is in-flight, but on a bad connection sendComment rejects/
      // resolves fast, reopening the lock so a mashed Enter re-sends with
      // a fresh uniqueId (SDK dedup can't catch it) — the Bank Raya case
      // #1084 duplicate-to-WA. Mirrors inbox-v2 chat.ts `lastSendPerRoom`.
      lastSentPerRoom: {},
      showAdsConverter: false,
      languages: [],
    };
  },
  mounted() {
    if (!this.isAssistant && window.aiAssistant && window.aiAssistant.baseURL) {
      window.aiAssistant.isRegistered().then((res) => {
        this.$emit('assistant-enabled', res.registered);
      });
    }
    this.textareaStyle = {
      color: this.core.UI.colors.formMessageTextColor,
    };

    const initialDraft = JSON.parse(localStorage.getItem('qcw-draft')) || [];
    const idxDraft = initialDraft.findIndex(dt => dt.id === this.core.selected.id);
    if (idxDraft > -1) {
      this.commentInput = initialDraft[idxDraft].messages;
    }

    // Case #1025: read qcw-draft FRESH on every debounce fire instead of
    // mutating a stale array captured at mount. trySubmitComment writes a
    // clean copy on send; the old closure then rewrote its stale array 1s
    // later, resurrecting the just-sent text when the agent returned.
    this.debouncedFetch = debounce((newValue) => {
      const draft = JSON.parse(localStorage.getItem('qcw-draft')) || [];
      const roomId = this.core.selected.id;
      const currentIdx = draft.findIndex(dt => dt.id === roomId);
      if (newValue && newValue !== '') {
        if (currentIdx > -1) {
          draft[currentIdx].messages = newValue;
        } else {
          draft.push({
            id: roomId,
            messages: newValue,
          });
        }
      } else if (currentIdx > -1) {
        draft.splice(currentIdx, 1);
      }
      localStorage.setItem('qcw-draft', JSON.stringify(draft));
    }, 1000);

    if (this.isIOSDevice && window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.scheduleRevealMessageForm);
    }
  },
  beforeDestroy() {
    clearTimeout(this.revealTimer);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.scheduleRevealMessageForm);
    }
  },
  computed: {
    sendBtnStatus() {
      return this.commentInput.length > 0
        ? this.core.UI.colors.formMessageIconHoverColor
        : this.core.UI.colors.formMessageIconColor;
    },
    showTwitterWordCount() {
      if (!this.core.selected || !('options' in this.core.selected))        { return false; }
      const check = this.core.selected.options
        ? JSON.parse(this.core.selected.options)
        : {};
      return Object.keys(check).length > 0
        ? JSON.parse(this.core.selected.options)
            .channel.toLowerCase()
            .includes('twitter')
        : false;
    },
    showCustomWordCount() {
      return this.core.UI.showChannelFormCount;
    },
    isMaxCountValid() {
      if (this.showCustomWordCount)        { this.maxCount = this.core.UI.maxChannelFormCount; }
      return this.commentInput.length <= this.maxCount;
    },
    inputCount() {
      return this.commentInput.length > 0
        ? 'opacity: 1; cursor: pointer'
        : 'opacity: 1; cursor: default';
    },
    inputMaxCount() {
      return this.isMaxCountValid && this.commentInput.length > 0
        ? 'opacity: 1; cursor: pointer'
        : 'opacity: 0.3; cursor: default';
    },
    lastMessage() {
      if (!this.isEmailMode) return null;
      const lastCommentUser = [...this.core.selected.comments]
        .reverse()
        .filter(
          c => c.type === 'custom' && c.payload.type === 'email_attachment',
        )
        .find((f) => {
          let usernameReal = f.username_real.toString();
          let userDataEmail = this.core.userData.toString();
          if (f.extras && f.extras.alternate_user) {
            usernameReal = f.extras.alternate_user.email.toString();
          }
          if (this.core.UI.alternateUser) {
            userDataEmail = this.core.UI.alternateUser.email.toString();
          }
          return usernameReal !== userDataEmail;
        });
      return lastCommentUser;
    },
  },
  methods: {
    async assistantMenuChange(value) {
      const filtered = this.core.selected.comments.filter(
        el => el.type === 'text',
      );

      // Create an async function to use await inside forEach
      const processFiltered = async () => {
        const filtering = [];
        filtered.forEach((val) => {
          if (
            val.user_extras !== undefined &&
            typeof val.user_extras === 'object'
          ) {
            if (val.user_extras.type === 'customer') {
              filtering.push({
                role: 'user',
                content: val.message,
              });
            } else {
              filtering.push({
                role: 'assistant',
                content: val.message,
              });
            }
          }
        });
        return filtering;
      };

      // Call the async function
      const historyChat = await processFiltered();
      const check = this.core.selected.options
        ? JSON.parse(this.core.selected.options)
        : {};
      this.$emit('assistant-changes', {
        history: historyChat,
        input: this.commentInput,
        menu: value,
        channel_id: check.channel_id,
      });
    },
    async assistantMenuChangeOnEmail(value) {
      const filtered = this.core.selected.comments.filter(
        el => el.type === 'custom' && el.message !== '',
      );

      // // Create an async function to use await inside forEach
      const processFiltered = async () => {
        const filtering = [];
        filtered.forEach(async (val) => {
          if (
            val.user_extras !== undefined &&
            typeof val.user_extras === 'object'
          ) {
            const turndownService = new TurndownService();
            const textarea = document.createElement('textarea');
            textarea.innerHTML = val.message;
            const content = await turndownService.turndown(textarea.value);
            if (val.user_extras.type === 'customer') {
              filtering.push({
                role: 'user',
                content,
              });
            } else {
              filtering.push({
                role: 'assistant',
                content,
              });
            }
          }
        });
        return filtering;
      };

      // // Call the async function
      const historyChat = await processFiltered();
      const check = this.core.selected.options
        ? JSON.parse(this.core.selected.options)
        : {};
      this.$emit('assistant-changes', {
        history: historyChat,
        input: this.$refs.emailEditor.getContents(),
        menu: value,
        channel_id: check.channel_id,
      });
    },
    handlePaste(event, isAttachment = false) {
      const self = this;
      if (event.clipboardData.items.length < 1) return true;
      const item = Array.from(event.clipboardData.items).find(
        it => it.kind === 'file',
      );
      if (typeof item === 'undefined' || item === null) return true;
      if (item.type.indexOf('image') === -1) return true;
      const file = item.getAsFile();
      const fileReader = new FileReader();
      fileReader.onload = () => {
        if (!isAttachment) {
          self.setAttachmentData({
            file,
            thumbnail: fileReader.result,
          });
        } else {
          self.emailAttachments.push(file);
        }
      };
      fileReader.readAsDataURL(file);
      return true;
    },
    handleImageData(event) {
      if (event) {
        this.imageData = event.target.files;
      } else {
        this.imageData = null;
        this.$refs.inputImage.value = null;
      }
    },
    handleUploadData(data) {
      const uploadData = this.uploadData;
      if (data.id) {
        const i = uploadData.findIndex(d => d.id === data.id);
        uploadData.splice(i, 1);
      } else {
        this.uploadDataId += 1;
        // Snapshot the reply onto the batch and release it here, so the
        // composer stops showing a quote for images already on their way.
        const repliedComment = this.repliedComment || null;
        if (repliedComment) this.closeReplyHandler();
        uploadData.push({
          id: this.uploadDataId,
          data: data.image,
          repliedComment,
        });
      }
      this.handleImageData(null);
    },
    handleFileData(event) {
      if (event) {
        this.fileData = event.target.files;
      } else {
        this.fileData = null;
        this.$refs.inputFile.value = null;
      }
    },
    handleUploadFile(data) {
      const uploadData = this.uploadData;
      if (data.id) {
        const i = uploadData.findIndex(d => d.id === data.id);
        uploadData.splice(i, 1);
      } else {
        this.uploadDataId += 1;
        // Same snapshot as `handleUploadData`: the paperclip (any file type)
        // and the image picker feed the SAME upload toast, so a reply has to
        // be carried onto the batch here too. Without it every non-image
        // attachment — doc, csv, video, sticker file — was posted as a plain
        // `file_attachment` and lost its quote, while images kept theirs.
        const repliedComment = this.repliedComment || null;
        if (repliedComment) this.closeReplyHandler();
        uploadData.push({
          id: this.uploadDataId,
          data: data.file,
          repliedComment,
        });
      }
      this.handleFileData(null);
    },
    trySubmitComment(e) {
      // send-lock: block re-submit while a text message is still in flight.
      // Without this, each submit gets a fresh unique_temp_id and bypasses
      // SDK dedup, producing separate duplicate comments (see inbox dup case).
      if (this.isSendingText) {
        if (e && e.preventDefault) e.preventDefault();
        return;
      }
      if (
        !this.isMaxCountValid &&
        (this.showTwitterWordCount || this.showCustomWordCount)
      )        { return; }
      if (!e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        // this code is needed for emoji implementation, dirty, but works, need to refine later
        const selector = '.qcw-comment-form textarea';
        const element = document.querySelector(selector);
        this.commentInput = element.value;
        let message = this.commentInput.trim();
        if (typeof emojione !== 'undefined')          { message = emojione.shortnameToUnicode(message); }
        if (this.commentInput.trim().length < 1) return;
        // Content-based dedup guard. Swallow an identical message to the
        // same room within 3s regardless of the in-flight lock — under a
        // bad connection sendComment settles fast, so mashing Enter would
        // otherwise fire N independent sends (each a fresh uniqueId) and
        // deliver duplicates to the customer (case #1084). A legit resend
        // of the exact same text inside 3s is vanishingly rare.
        const roomId = this.core.selected.id;
        const now = Date.now();
        const lastSent = this.lastSentPerRoom[roomId];
        if (lastSent && lastSent.text === message && now - lastSent.at < 3000) {
          this.commentInput = '';
          return;
        }
        this.lastSentPerRoom[roomId] = { text: message, at: now };
        // remove draft
        const draft = JSON.parse(localStorage.getItem('qcw-draft')) || [];
        const idxDraft = draft.findIndex(dt => dt.id === this.core.selected.id);
        if (idxDraft > -1) draft.splice(idxDraft, 1);
        localStorage.setItem('qcw-draft', JSON.stringify(draft));
        this.commentInput = '';
        this.submitComment(this.core.selected.id, message);
      }
    },
    submitComment(topicId, comment) {
      const self = this;
      let extras = null;
      const nanotimestamp =
        window.performance.now() + window.performance.timeOrigin;
      const uniqueId = `${topicId}_${nanotimestamp}`;
      if (self.core.UI.alternateUser) {
        extras = {
          alternate_user: self.core.UI.alternateUser,
        };
      }

      if (
        self.core &&
        self.core.selected &&
        self.core.selected.comments &&
        Array.isArray(self.core.selected.comments) &&
        self.core.selected.comments.length > 0
      ) {
        const lastComment =
          self.core.selected.comments[self.core.selected.comments.length - 1];

        if (lastComment && lastComment.extras) {
          const lastExtras = lastComment.extras;

          if (
            lastExtras &&
            lastExtras.referral &&
            lastExtras.referral.call &&
            lastExtras.referral.call.agent &&
            lastExtras.referral.call.agent.is_calling
          ) {
            extras = {
              referral: {
                call: {
                  agent: {
                    is_calling: lastExtras.referral.call.agent.is_calling,
                  },
                },
              },
            };
          }
        }
      }

      self.isSendingText = true;
      if (self.repliedComment === null) {
        self.core
          .sendComment(topicId, comment, uniqueId, 'text', null, extras)
          .then((res) => {
            scrollIntoLastElement(self.core);
            self.core.options.sentMessageCallback(res);
          })
          .finally(() => {
            self.isSendingText = false;
          });
      } else {
        let messageText = comment;
        if (
          self.repliedComment.unique_temp_id &&
          self.repliedComment.unique_temp_id.toLowerCase().includes('wa_wamid')
        ) {
          if (messageText.includes('[file]')) {
            const msgSplit = messageText.split('[file]');
            messageText = msgSplit[msgSplit.length - 1]
              .replace('[/file]', '')
              .trim();
          }
        }
        // Same reference the attachment path attaches, from the one helper, so
        // a text reply and a file reply cannot drift apart.
        extras = withChannelReplyRef(extras, self.repliedComment);
        const payload = {
          text: messageText,
          replied_comment_id: self.repliedComment.id,
          replied_comment_message: self.repliedComment.message,
          replied_comment_payload: self.repliedComment.payload,
          replied_comment_sender_email: self.repliedComment.username_real,
          replied_comment_sender_username: self.repliedComment.username_as,
          replied_comment_type: self.repliedComment.type,
        };
        self.closeReplyHandler();
        self.core
          .sendComment(
            topicId,
            messageText,
            uniqueId,
            'reply',
            JSON.stringify(payload),
            extras,
          )
          .then((res) => {
            scrollIntoLastElement(self.core);
            self.core.options.sentMessageCallback(res);
          })
          .finally(() => {
            self.isSendingText = false;
          });
      }
    },
    typingHandler(event) {
      if (!this.isEmailMode) {
        this.resizeCommentForm(event.currentTarget);
      }
      if (!this.delayTyping) {
        this.delayTyping = true;
        if (this.core.UI.isPublishTyping) {
          this.publishTyping(); // publish typing to mqtt
        }
        setTimeout(() => {
          this.delayTyping = false;
        }, 5000);
      }
    },
    // Runs on focus and on every keyboard-driven viewport resize; waits for the
    // keyboard animation (~300ms) so Safari's own pan, when it happens, lands
    // first and this is a no-op. See revealMessageForm in utils.
    scheduleRevealMessageForm() {
      clearTimeout(this.revealTimer);
      this.revealTimer = setTimeout(() => {
        const textarea = this.$el && this.$el.querySelector('textarea');
        if (textarea && document.activeElement === textarea) revealMessageForm();
      }, 350);
    },
    resizeCommentForm(target) {
      const treshold = 80;
      const textarea = target;
      // Hidden (closed widget): scrollHeight is 0 and would collapse the form.
      if (!textarea.getClientRects().length) return;
      const formContainerStyle = window.getComputedStyle(
        textarea.parentElement,
      );
      const pt = parseInt(formContainerStyle.paddingTop, 10);
      const pb = parseInt(formContainerStyle.paddingBottom, 10);
      textarea.style.height = '20px';
      if (textarea.scrollHeight < treshold) {
        textarea.style.height = `${textarea.scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
        textarea.parentElement.style.flexBasis = `${textarea.scrollHeight +
          pt +
          pb +
          2}px`;
      } else {
        textarea.style.overflowY = 'scroll';
        textarea.style.height = `${treshold}px`;
        textarea.parentElement.style.flexBasis = `${treshold + pt + pb + 2}px`;
      }
    },
    publishTyping() {
      const self = this;
      if (this.core.selected.isChannel) return;
      if (self.commentInput.length > 0) {
        self.core.realtimeAdapter.publishTyping(1);
      } else {
        self.core.realtimeAdapter.publishTyping(0);
      }
    },
    setEmailAttachment(e) {
      const files = e.target.files;
      this.emailAttachments.push(...files);
      e.target.value = '';
    },
    calculateSizeInMB,
    deleteAttachment(index) {
      this.emailAttachments.splice(index, 1);
    },
    clearAllMessage() {
      this.commentInput = '';
      this.emailAttachments = [];
      this.$refs.emailEditor.deleteText();
      this.$refs.emailEditor.clearQuotted();
    },
    emojiParser() {
      const selector = '.qcw-comment-form textarea';
      const element = document.querySelector(selector);
      this.commentInput = element.value;
      let message = this.commentInput.trim();
      if (typeof emojione !== 'undefined')        { message = emojione.shortnameToUnicode(message); }
      this.commentInput = '';
      return message;
    },
    async sendEmailMessage() {
      const self = this;
      let isFailedUpload = false;
      self.isSendingEmail = true;
      // eslint-disable-next-line
      for (let i = 0; i < self.emailAttachments.length; i++) {
        try {
          const file = self.emailAttachments[i];
          if (!file.url) {
            // eslint-disable-next-line
            const url = await uploadEmailAttachment(
              file,
              self.core,
              self.$toasted,
            );
            self.emailAttachments[i].url = url;
          }
        } catch (error) {
          isFailedUpload = true;
          break;
        }
      }
      if (isFailedUpload) return;
      const message = self.commentInput;
      if (message.trim().length < 1 && self.emailAttachments.length === 0)        { return; }
      let extras = null;
      if (self.core.UI.alternateUser) {
        extras = {
          alternate_user: self.core.UI.alternateUser,
        };
      }
      let files = [];
      if (self.emailAttachments.length > 0) {
        files = self.emailAttachments.map(f => ({
          file_name: f.name,
          size: f.size,
          url: f.url,
        }));
      }
      let emailData = {
        subject: '',
        cc: [],
        bcc: [],
      };
      if (this.lastMessage && this.lastMessage.payload.content.email_data) {
        emailData = { ...this.lastMessage.payload.content.email_data };
      }
      const generateTypeMessage = self.core.generateCustomMessage({
        roomId: self.core.selected.id,
        text: message,
        type: 'email_attachment',
        payload: { email_attachment: files, email_data: emailData },
        extras,
      });
      self.clearAllMessage();
      self.core
        .sendComment(
          generateTypeMessage.room_id,
          generateTypeMessage.message,
          generateTypeMessage.unique_id,
          generateTypeMessage.type,
          generateTypeMessage.payload,
          generateTypeMessage.extras,
        )
        .then((res) => {
          self.isSendingEmail = false;
          scrollIntoLastElement(self.core);
          self.core.options.sentMessageCallback(res);
        })
        .catch(() => {
          self.isSendingEmail = false;
        });
    },
    onchangeEmailForm(value) {
      this.typingHandler(null);
      const onlyText = this.cleanHtml(value);
      this.commentInput = onlyText ? value : '';
    },
    cleanHtml(textWithHtml) {
      const text = document.createElement('div');
      text.innerHTML = textWithHtml;
      return text.innerText;
    },
    setLanguages(value) {
      this.$emit('assistant-language', value);
    },
  },
  watch: {
    assistantApply(newValue) {
      if (newValue) {
        if (!this.isEmailMode) {
          this.commentInput = this.assistantResult;
          this.$emit('assistant-changes', {
            history: null,
            input: '',
            menu: null,
            channel_id: null,
          });
          this.$emit('assistant-apply', false);
        } else {
          this.$refs.emailEditor.setText(this.assistantResult);
          this.$emit('assistant-changes', {
            history: null,
            input: '',
            menu: null,
            channel_id: null,
          });
          this.$emit('assistant-apply', false);
        }
      }
    },
    commentInput(val, ...args) {
      this.debouncedFetch(val, ...args);
      // Re-measure on every value change, not only on keyup: a paste, a draft
      // restore, or clearing the input after a send (send button, Enter, dedup
      // guard) never fires keyup, which left the textarea one line tall with
      // pasted multi-line text, or stuck at a sent message's height.
      if (!this.isEmailMode) {
        this.$nextTick(() => {
          const textarea = document.querySelector('.qcw-comment-form textarea');
          if (textarea) this.resizeCommentForm(textarea);
        });
      }
    },
    'core.selected.id': {
      immediate: true,
      handler(id) {
        this.commentInput = '';
        const draft = JSON.parse(localStorage.getItem('qcw-draft')) || [];
        const idxDraft = draft.findIndex(dt => dt.id === id);
        if (idxDraft > -1) {
          this.commentInput = draft[idxDraft].messages;
        }
        setTimeout(() => {
          const selector = '.qcw-comment-form textarea';
          const textarea = document.querySelector(selector);
          if (textarea) {
            this.resizeCommentForm(textarea);
            focusMessageForm();
          }
        }, 200);
      },
    },
  },
};
</script>

<style lang="stylus">
@import '../assets/stylus/_variables.styl'
.backdrop-enter-active,
.backdrop-leave-active
  -webkit-transition all 0.5s ease
  transition all 0.5s ease

.backdrop-enter,
.backdrop-leave-to
  opacity 0 !important

.backdrop-enter-to,
.backdrop-leave
  opacity 0.5 !important

.fade-enter-active,
.fade-leave-active
  -webkit-transition all 0.3s ease
  transition all 0.3s ease

.fade-enter,
.fade-leave-to
  opacity 0

.fade-leave-active
  position absolute

.qcw-send--sending,
.qcw-send--disabled
  opacity 0.45
  pointer-events none
  cursor default

.qcw-comment-form
  display flex
  justify-content space-between
  position relative
  order 2
  transition all 0.05s ease-out
  padding: 8px 13px 13px;

  @media screen and (max-width: 600px)
    padding 16px 32px
  &.email-mode
    flex-direction column
    padding 18px 8px
    .email-form-footer
      margin-top 20px
      display flex
      align-items center
      justify-content space-between
      .container-email-button
        display flex
        align-items center
        gap 10px
        margin 0px 5px
        .send-button-email
          padding 10px 32px
          border none
          border-radius 24px
          background #27B199
          color white
          cursor pointer
          flex-shrink 0
          &:disabled
            background #B6B6B6
            cursor not-allowed
.container-form-msg
  border 1px solid #C4C4C4
  border-radius 8px
.box-form
  border 1px solid #C4C4C4
  box-sizing border-box
  flex 1
  border-radius 8px
  background $white
  @media screen and (max-width: 600px)
    position relative
    border-radius 64px
    border 1px solid $lightGrey
    padding 16px
    background $darkWhite
    display flex
    gap 8px
  .box-uploader
    display flex
    justify-content space-between
    padding-left 16px
    padding-right 16px
    margin-bottom 8px
    > span
      display flex
      align-items center
      @media screen and (min-width: 601px)
        flex-basis: 20px;
      @media screen and (max-width: 600px)
        background $primary
        padding 4px 12px
        border-radius 12px
        display flex
        align-items center
        justify-content center
        cursor pointer
      > .qc-icon
        stroke #27b199
        @media screen and (max-width: 600px)
          stroke $white
          width 16px
          height 16px
    > div
      > span
        margin-right 16px
        svg.qc-icon
          margin-top 0
          @media screen and (max-width: 600px)
            width 24px
            height 24px
            margin-top 0
      > div
        display flex
        > *
          margin-right 16px

    @media screen and (max-width: 600px)
      padding 0
      margin 0
      gap 16px
      > div > div
        display none

.input-form
  border 0
  box-sizing border-box
  flex 1
  display flex
  flex-direction row
  border-radius 8px
  padding 16px 30px 16px 16px
  margin 0

  @media screen and (max-width: 600px)
    // border-radius 64px
    // border 1px solid $lightGrey
    border-radius 0
    padding 0
    align-self center
    // background $darkWhite
    textarea
      background transparent
      width 100%
  &.email-mode-input
    border none
    padding 16px 0px

.qcw-comment-form textarea
  border 0
  flex 1
  font-size 14px
  font-family inherit
  line-height 20px
  max-height 80px
  min-height 20px
  resize none
  padding 0
  &::-webkit-scrollbar-track
    border-radius 10px
    background-color #fafafa

  &::-webkit-scrollbar
    width 0px
    background-color #fafafa

  &::-webkit-scrollbar-thumb
    border-radius 4px
    background-color #e0e0e0
  &:focus
    border 0
    outline none
  @media screen and (min-width: 601px)
    min-height 42px

.qcw-comment-form span
  text-align center
  flex 0 24px
  align-self center

  label
    cursor pointer
    display flex

  input[type="file"]
    display none

  &.qcw-icon:hover svg.qc-icon
    fill $green

.qcw-upload-toast
  position absolute
  bottom 64px
  right 10px
  z-index 2
  display flex
  flex-direction column

.qcw-text-warning
  color #e55039 !important

@media screen and (max-width: 600px)
  .hidden-sm
    display none !important
.btn-agent-copilot
  &:hover
    color unset !important
  &:focus
    color unset !important
</style>
