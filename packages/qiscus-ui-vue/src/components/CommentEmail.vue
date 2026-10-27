<template>
  <div :id="comment.id">
    <div
      v-if="comment.type == 'system_event'"
      :class="{[`qcw-comment--${this.comment.type}`]: true }"
      class="qcw-comment-container"
      style="border-bottom: 1px solid #E8E8E8;">
      <div class="qcw-comment--system-event" style="margin: 24px auto;">
        <comment-custom v-if="core.customTemplate && haveTemplate(comment)" :data="systemEventComment"></comment-custom>
        <!-- v-html so http(s) URLs are clickable; systemEventHtml escapes first -->
        <div v-else v-html="systemEventHtml"></div>
      </div>
    </div>
    <div v-else>
      <div class="comment-email-header">
        <div class="item">
          <avatar :src="commentAvatar(avatar)" />
        </div>
        <div class="item item-expand">
          <div class="email-properties">
            <span class="properties-label">From</span>
            <span class="properties-separator">:&nbsp;</span>
            <span>{{ emailFrom }}</span>
          </div>
          <div class="email-properties">
            <span class="properties-label">To</span>
            <span class="properties-separator">:&nbsp;</span>
            <span>{{ emailTo }}</span>
          </div>
        </div>
        <div class="item item-right">
          <span>{{ messagetimestamp }}</span>
        </div>
      </div>
      <div class="comment-email-body">
        <p v-if="emailData" class="email-subject"> {{ isAgent ? 'Re: ': '' }}{{ emailData.subject }}</p>
        <div class="comment-email-body--parsed" v-html="parsedMessage"></div>
      </div>
      <div v-if="isContainsAttachment && listFile.length > 0" class="comment-email-attachment">
        <div class="file-attachment-container">
          <div v-for="(file, i) in listFile" :key="i" class="files-item">
            <div class="image-icon" :class="{ 'is-downloading': file.isDownloading }">
              <span v-if="file.isDownloading" style="color: white; cursor: pointer">
                <small>{{ file.downloadProgress }}</small>
              </span>
              <icon v-if="!file.isDownloading" class="file-icon" name="ic-docs-attachment-render-buble" style="margin: 0px; fill: white" />
              <a v-if="!file.isDownloading" @click="downloadFile(file, i)">
                <icon name="ic-download" class="file-download" />
              </a>
            </div>
            <ul>
              <li class="file-name" :title="file.file_name">{{ file.file_name }}</li>
              <li style="color: #9F9F9F;">{{ file.sizeInMb }}</li>
            </ul>
          </div>
        </div>
        <button class="button-download" style="margin: 0 18px" :disabled="isAnyDownloadingRun"  @click="downloadAll">Download All</button>
      </div>
    </div>
  </div>
</template>
<script>
import QiscusTextParser from '../lib/textparser';
import { calculateSizeInMB } from '../lib/utils';
import Icon from './Icon';
import Avatar from './Avatar';
import CommentCustom from './CommentCustom';
import {
  maskSystemEventAgentName,
  renderSystemEventHtml,
} from '../helpers/systemEventMask';

export default {
  name: 'CommentEmail',
  components: {
    Icon,
    Avatar,
    CommentCustom,
  },
  props: ['comment', 'userData', 'customerEmail', 'core'],
  computed: {
    /**
     * System-event text with agent names masked when the tenant enables
     * `hideSystemEventAgentName` (set on core.UI by the host). See
     * helpers/systemEventMask.js.
     */
    systemEventMessage() {
      const msg = this.comment.message;
      return this.core && this.core.UI && this.core.UI.hideSystemEventAgentName
        ? maskSystemEventAgentName(msg)
        : msg;
    },
    /**
     * HTML for the system-event row: same `<time> - <message>` text as before
     * (masking already applied) but with http(s) URLs turned into clickable
     * links. Escaped before linkify, so v-html binding is safe.
     */
    systemEventHtml() {
      const raw = this.unsanitizeHTML(`${this.comment.time} - ${this.systemEventMessage}`);
      return renderSystemEventHtml(raw);
    },
    /**
     * Masked comment object for the custom-template path (`comment-custom`),
     * so `templateFunction`'s `{message}` substitution can't leak the raw agent
     * name. Returns the original object untouched when nothing is masked.
     */
    systemEventComment() {
      const masked = this.systemEventMessage;
      return masked === this.comment.message
        ? this.comment
        : { ...this.comment, message: masked };
    },
    parsedMessage() {
      const parseHtml = this.comment.type === 'file_attachment' ? this.comment.payload.caption : QiscusTextParser.parseForEmail(this.comment.message);
      return (typeof emojione !== 'undefined') ? emojione.toImage(parseHtml) : parseHtml;
    },
    isAgent() {
      return this.customerEmail !== this.comment.username_real.toString();
    },
    avatar() {
      if (this.comment.extras && this.comment.extras.alternate_user) {
        return this.comment.extras.alternate_user.avatar.toString();
      }
      return this.comment.avatar || 'https://d1edrlpyc25xu0.cloudfront.net/kiwari-prod/image/upload/D1se5xo40I/1516941944-Screen_Shot_2018-01-26_at_11.45.20.png';
    },
    messagetimestamp() {
      const date = new Date(this.comment.timestamp);
      const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      };
      return date.toLocaleDateString('en-US', options);
    },
    emailFrom() {
      let usernameAgent = this.comment.username_as;
      const altUser = this.comment.extras && this.comment.extras.alternate_user;
      if (altUser && altUser.name) {
        usernameAgent = altUser.name;
      }
      return this.isAgent ? `Agent (${usernameAgent})` : this.comment.email;
    },
    emailTo() {
      return !this.isAgent ? 'Me' : this.customerEmail;
    },
    isEmailAttachment() {
      return this.comment.type === 'custom' && (this.comment.payload && this.comment.payload.type === 'email_attachment');
    },
    isContainsAttachment() {
      return this.comment.type === 'file_attachment' || this.isEmailAttachment;
    },
    emailData() {
      if (this.isEmailAttachment) {
        return this.comment.payload.content.email_data || null;
      }
      return null;
    },
    isAnyDownloadingRun() {
      return this.listFile.some(a => a.isDownloading);
    },
  },
  data() {
    return {
      listFile: [],
    };
  },
  mounted() {
    this.listFile = this.setListFile();
  },
  methods: {
    setListFile() {
      if (!this.isContainsAttachment) return [];
      if (this.isEmailAttachment) {
        if (this.comment.payload &&
          this.comment.payload.content &&
          this.comment.payload.content.email_attachment
        ) {
          return this.comment.payload.content.email_attachment.map(file => ({
            ...file,
            sizeInMb: calculateSizeInMB(file.size),
            isDownloading: false,
            downloadProgress: 0,
          }));
        }
        return [];
      }
      const fileAttachment = this.comment.payload;
      const stringSplit = fileAttachment.url.split('/');
      const fileName = stringSplit.slice(-1)[0];
      return [{
        file_name: fileName,
        url: fileAttachment.url,
        size: fileAttachment.size,
        sizeInMb: '0KB',
        isDownloading: false,
        downloadProgress: 0,
      }];
    },
    commentAvatar(avatar) {
      if (avatar) {
        if (avatar.includes('//image.flaticon.com/icons')) {
          return 'https://multichannel.qiscus.com/img/default_avatar.svg';
        }
        return avatar;
      }
      return this.core.avatar_url;
    },
    haveTemplate(comment) {
      if (!this.core.customTemplate) return false;
      return this.core.templateFunction(comment);
    },
    unsanitizeHTML(content) {
      return content
        ? content.replace(/(&gt;)/g, '>').replace(/(&lt;)/g, '<')
        : content;
    },
    downloadAll() {
      this.listFile.forEach((f, i) => {
        this.downloadFile(f, i);
      });
    },
    downloadFile(file, i) {
      const self = this;
      if (file.isDownloading) return;
      self.listFile[i].isDownloading = true;
      self.listFile[i].downloadProgress = 0;
      const url = `/services/download?url=${file.url}`;
      const filename = file.file_name;
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';

      xhr.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          self.listFile[i].downloadProgress = progress.toFixed(0);
        }
      });

      xhr.addEventListener('error', (event) => {
        self.listFile[i].isDownloading = false;
        self.listFile[i].downloadProgress = 0;
        console.error(event);
      });

      xhr.addEventListener('load', () => {
        self.listFile[i].isDownloading = false;
        const blob = new Blob([xhr.response], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
      });

      xhr.open('GET', url);
      xhr.send();
    },
  },
};
</script>

<style scoped>
.comment-email-header {
  padding: 16px 24px;
  background: #F2F2F6;
  display: flex;
  gap: 15px;
  align-items: center;
  font-size: 14px;
  border-bottom: 1px solid #E8E8E8;
}
.comment-email-body {
  padding: 24px;
  min-height: 250px;
  background: #FAFAFA;
  border-bottom: 1px solid #E8E8E8;
  word-break: break-word;
  font-size: 14px;
}
.comment-email-body--parsed {
  white-space: pre-wrap;
}
.comment-email-attachment {
  border-bottom: 1px solid #E8E8E8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.item {
  display: flex;
  align-items: center;
}
.email-properties {
  display: flex;
}
.properties-separator {
  color: #B6B6B6;
}
.properties-label {
  width: 50px;
  color: #B6B6B6;
}
.item-expand {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: start;
}
.item-right {
  margin-left: auto;
  align-self: start;
}
.file-attachment-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
.files-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px;
  font-size: 14px;
  width: 300px;
}
.image-icon {
  width: 40px;
  height: 40px;
  background: #27B199;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 100%;
}
.image-icon:not(.is-downloading):hover {
  background: rgba(0, 0, 0, 0.603);
}
.image-icon:not(.is-downloading):hover .file-icon {
  display: none;
}
.image-icon:hover .file-download {
  display: unset;
}
.file-name {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 200px;
}
.file-download {
  width: 18px;
  height: 18px;
  cursor: pointer;
  color: white;
  display: none;
}
.button-download {
  padding: 10px 32px;
  background: none;
  border-radius: 100px;
  cursor: pointer;
  border: 1px solid #27B199;
  color: #27B199;
  white-space: nowrap;
}
.button-download:disabled {
  color: gray;
  border: 1px solid gray;
  cursor: not-allowed;
}
.email-subject {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
}

.is-downloading {
  position: relative;
  width: 40px;
  height: 40px;
  border: 3px solid #ccc;
  border-radius: 50%;
}

.is-downloading::after {
  content: "";
  position: absolute;
  width: 40px;
  height: 40px;
  border: 3px solid transparent;
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0);
  }
  100% {
    transform: rotate(360deg);
  }
}

</style>

<style>
.comment-email-body--parsed blockquote {
  border-left: 1px solid #ccc;
  padding-left: 16px;
  color: #500050;
  margin: 0px 40px 0px;
}
</style>
