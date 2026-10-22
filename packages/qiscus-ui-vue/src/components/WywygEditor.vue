<template>
  <div ref="containerEditorRef" class="container-custom-editor">
    <div ref="quillEditorTarget"></div>
    <div ref="wrapperToolbarRef" class="wrapper-toolbar">
      <div>
        <span v-if="quotedMessageData" class="elipsis-quoted-message" :style="{ marginBottom: showQuottedMessage ? '0px' : '16px' }" @click="toggleShowQuoteMessage">...</span>
        <div v-if="showQuottedMessage" class="container-quotted-message" v-html="quotedMessageData" />
      </div>
      <div v-if="emailAttachments && emailAttachments.length > 0" class="container-email-attachments">
        <span
          v-for="(attachment, i) in emailAttachments" :key="i"
          class="email-attachments-item"
        >
          <div class="name" :title="attachment.name">
            {{ attachment.name }} ({{ calculateSizeInMB(attachment.size) }})
          </div>
          <i class='qcw-icon' style="cursor: pointer" @click="deleteAttachment(i)">
            <icon name="ic-close" fill="#EF7D7C" style="width: 15px; height: 15px;" />
          </i>
        </span>
      </div>
      <div id="customToolbarplace">
        <button class="ql-bold"></button>
        <button class="ql-italic"></button>
        <button class="ql-underline"></button>
        <button class="ql-strike"></button>
        <button class="ql-align" value="right"></button>
        <button class="ql-align" value="center"></button>
        <button class="ql-align" value="justify"></button>
        <button class="ql-list" value="ordered"></button>
        <button class="ql-list" value="bullet"></button>
        <span class="ql-separator" />
        <select class="ql-size" style="border: 1px solid #BFBFBF">
          <option value="small"></option>
          <option selected></option>
          <option value="large"></option>
          <option value="huge"></option>
        </select>
        <button class="qlc-quote-previous-email" :class="{ 'active': !!quotedMessageData }" @click="quoteMessage" :title="!quotedMessageData ? 'Quote previous message' : 'Clear quoted previous message'">
          <icon name="ic-quoted-email" :style="{ fill: 'none', marginTop: '0px', width: '20px', height: '20px'  }" />
        </button>
        <span v-if="$slots.additionalButton" class="ql-separator" />
        <slot name="additionalButton" />
        <span class="counter-limit">
          <small>{{textLength}}/{{maxCharacter}}</small>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import 'quill/dist/quill.snow.css';
import 'quill/dist/quill.core.css';

import Quill from 'quill';
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
import TurndownService from 'turndown';
import { calculateSizeInMB } from '../lib/utils';
import Icon from './Icon';
import QiscusTextParser from '../lib/textparser';

const basicStylingQuotedMessage = 'border-left: 1px solid #ccc;margin-bottom: 5px; margin-top: 5px; padding-left: 16px; margin-left: 40px;';
export default {
  name: 'WywygEditor',
  components: {
    Icon,
  },
  props: ['emailAttachments', 'core'],
  computed: {
    textLength() {
      if (this.QuillObject) {
        return this.QuillObject.getText().length - 1;
      }
      return 0;
    },
    comments() {
      if (this.core) {
        return this.core.selected.comments;
      }
      return [];
    },
    customerEmail() {
      const participants = this.core.selected.participants;
      let email = '-';
      const user = participants.filter(u => u.extras === null || u.extras.type === undefined || u.extras.type !== 'agent');
      if (user.length) {
        email = user[0].email;
      }
      return email;
    },
  },
  data() {
    return {
      QuillObject: null,
      maxCharacter: 3000,
      quotedMessageData: '',
      showQuottedMessage: false,
    };
  },
  watch: {
    emailAttachments() {
      this.recalculateHeight();
    },
  },
  mounted() {
    this.QuillObject = new Quill(this.$refs.quillEditorTarget, {
      modules: {
        toolbar: '#customToolbarplace',
      },
      theme: 'snow',
      formats: ['bold', 'underline', 'italic', 'link', 'align', 'list', 'size', 'strike', 'blockquote'],
      placeholder: 'Type something in here!',
    });
    this.QuillObject.on('text-change', this.emitOnchange);
  },
  beforeDestroy() {
    this.QuillObject.off('text-change', this.emitOnchange);
  },
  methods: {
    recalculateHeight() {
      if (this.$refs.containerEditorRef) {
        setTimeout(() => {
          this.$refs.containerEditorRef.style.marginBottom = `${this.$refs.wrapperToolbarRef.offsetHeight}px`;
        }, 0);
      }
    },
    getContentData() {
      if (this.textLength > this.maxCharacter) {
        this.QuillObject.deleteText(this.maxCharacter, this.QuillObject.getLength());
      }
      const contents = this.QuillObject.getContents();
      const converter = new QuillDeltaToHtmlConverter(
        contents.ops,
        {
          inlineStyles: true,
          encodeHtml: false,
        },
      );
      let html = converter.convert();
      const temp = document.createElement('div');
      temp.innerHTML = html.replace(/\u00A0/g, ' ');
      temp.querySelectorAll('blockquote').forEach((bq) => {
        /* eslint-disable no-param-reassign */
        bq.style.borderLeft = '1px solid #ccc';
        bq.style.marginBottom = '5px';
        bq.style.marginTop = '5px';
        bq.style.paddingLeft = '16px';
        /* eslint-enable no-param-reassign */
      });
      html = temp.innerHTML;
      return html;
    },
    emitOnchange() {
      const html = this.getContentData();
      const htmlPlusQuoted = html + this.quotedMessageData;
      this.$emit('onchange', htmlPlusQuoted);
    },
    deleteText() {
      this.QuillObject.deleteText(0, this.QuillObject.getLength());
    },
    setText(value) {
      this.QuillObject.setText(value);
    },
    getContents() {
      const contents = this.QuillObject.getContents();
      const converter = new QuillDeltaToHtmlConverter(
        contents.ops,
        {
          inlineStyles: true,
          encodeHtml: false,
        },
      );
      const html = converter.convert();
      const turndownService = new TurndownService();
      return turndownService.turndown(html);
    },
    calculateSizeInMB,
    deleteAttachment(index) {
      this.$emit('ondeleteAttachment', index);
    },
    quoteMessage() {
      if (this.quotedMessageData) {
        this.clearQuotted();
        this.recalculateHeight();
        this.showQuottedMessage = false;
        return;
      }

      const message = this.comments.length > 0 ? this.comments[this.comments.length - 1] : null;
      if (!message) {
        return;
      }

      const parseHtml =
        message.type === 'file_attachment'
          ? message.payload.caption
          : QiscusTextParser.parseForEmail(message.message).trim();
      const parsedEmoji =
        typeof emojione !== 'undefined' ? emojione.toImage(parseHtml) : parseHtml;

      const date = new Date(message.timestamp);
      const formatted = date.toLocaleString('en-US', {
        timeZoneName: 'short',
      });
      const senderEmail = this.emailFrom(message);
      const header = `On ${formatted}, ${senderEmail} wrote:<br>`;
      const body = parsedEmoji.replace(/&gt;\s*/g, '');
      const quotedHtml = `\n\n<blockquote style="${basicStylingQuotedMessage}">${header}<pre>${body}</pre></blockquote>`;
      this.quotedMessageData = quotedHtml;
      this.recalculateHeight();
      this.emitOnchange();
    },
    emailFrom(comment) {
      let usernameAgent = comment.username_as;
      const altUser = comment.extras && comment.extras.alternate_user;
      if (altUser && altUser.name) {
        usernameAgent = this.comment.extras.alternate_user.name;
      }
      return this.customerEmail !== comment.username_real.toString()
        ? `Agent (${usernameAgent})`
        : comment.email;
    },
    clearQuotted() {
      this.quotedMessageData = '';
      this.emitOnchange();
    },
    toggleShowQuoteMessage() {
      this.showQuottedMessage = !this.showQuottedMessage;
      this.recalculateHeight();
    },
  },
};
</script>
<style>
.ql-snow .ql-editor blockquote {
  border-left: 3px solid #ccc;
  margin-bottom: 0px;
  margin-top: 0px;
  padding-left: 16px;
  margin-left: 40px;
  color: #500050;
  background: rgba(216, 216, 216, 0.253);
}
.ql-editor blockquote blockquote {
  border-left: 3px solid #ccc;
  background-color: #f9f9f9;
}
.container-custom-editor {
  width: 100%;
  position: relative;
  margin-bottom: 37px;
  max-height: 100px;
  transition: margin-bottom 0.3s ease;
}
.ql-container.ql-snow {
  border: none !important;
  font-family: inherit;
  font-size: 14px;
}
.ql-editor.ql-blank::before {
  font-style: normal;
}
.wrapper-toolbar {
  position: absolute;
  width: 100%;
}
#customToolbarplace {
  position: relative;
  /* width: 100%; */
  border: none;
  padding: 15px 0px 0px 10px;
}
.ql-snow .ql-picker.ql-expanded .ql-picker-options {
  top: unset !important;
  bottom: 100%;
}
#customToolbarplace > .counter-limit {
  position: absolute;
  right: 15px;
  color: #B6B6B6;
}
.container-email-attachments {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  margin: 0px 15px;
  gap: 20px;
}
.quote-message {
  padding: 2px 5px 2px 8px;
}
.container-email-attachments > .email-attachments-item {
  display: flex;
  align-items: center;
  background: #E7E7E7;
  padding: 2px 5px 2px 8px;
  border-radius: 4px;
}
.email-attachments-item .name {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  margin-right: 20px;
}
.container-quotted-message {
  font-size: 14px;
  color: #500050;
  max-height: 148px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.elipsis-quoted-message {
  margin-left: 32px;
  padding: 0px 4px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  background: #E7E7E7;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 10px;
  padding-bottom: 6px;
  cursor: pointer;
}

.qlc-quote-previous-email {
  color: #565656;
  margin-left: 12px;
}

.qlc-quote-previous-email.active, .qlc-quote-previous-email.active:hover, .qlc-quote-previous-email.focus  {
  color: red !important;
}
.ql-toolbar .ql-separator {
  background: #BFBFBF;
  width: 1px;
  height: 24px;
  float: left;
  margin: 0px 12px;
}
</style>
