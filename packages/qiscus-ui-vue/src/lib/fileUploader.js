import { scrollIntoLastElement } from './utils';
import {
  buildReplyPayload,
  replyFileMessage,
  withChannelReplyRef,
} from './replyPayload';

// `repliedComment` is the bubble the sender picked Reply on, or null for a
// plain send. It used to be dropped on the floor here: the upload always posted
// a bare `file_attachment`, so an attachment sent while a reply was active
// arrived with no quote at all — on the Live Chat widget and in the agent's
// room alike. Both renderers can already draw a reply that carries a file; they
// were simply never sent one.
export const uploadFile = (e, caption, core, toasted, extras, repliedComment = null, failedText = 'File uploading failed') => {
  let files = e instanceof Event ? e.target.files || e.dataTransfer.files : [e];
  const formData = new FormData();
  const roomId = core.selected.id;
  const uploadApiURL = core.uploadURL

  // check allowed file type
  // ambil dulu extensi file nya sebelumnya.
  // console.log(files);
  let ext = files[0].name.split('.');
  ext = ext[ext.length - 1] || null;
  if (core.allowedFileTypes && core.allowedFileTypes.indexOf(ext) < 0) {
    return toasted.error(failedText);
  }

  // force lowercase extension
  if(ext) ext = ext .toLowerCase();
  let filename = files[0].name.split(".");
  filename[filename.length - 1] = ext;

  // all clear, let's upload
  formData.append('file', files[0], filename.join("."));
  formData.append('token', core.userData.token);
  core.addUploadedFile(files[0].name, roomId);
  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (uploadEvent) => {
    updateProgress(uploadEvent, files[0].name, core);
  });
  xhr.open('POST', core.uploadURL, true);
  xhr.setRequestHeader('qiscus_sdk_app_id', `${core.AppId}`);
  xhr.setRequestHeader('qiscus_sdk_user_id', `${core.user_id}`);
  xhr.setRequestHeader('qiscus_sdk_token', `${core.userData.token}`);
  xhr.onload = function responseReceived() {
    if (xhr.status === 200) {
      // file(s) uploaded), let's post to comment
      const url = JSON.parse(xhr.response).results.file.url;
      const attachmentPayload = {
        url,
        caption: caption || '',
        file_name: files[0].name,
      };
      const commentText = `[file] ${url} [/file]`;
      let nanotimestamp = (window.performance.now() + window.performance.timeOrigin);
      let uniqueId = roomId +'_'+ nanotimestamp;

      // A reply carrying a file is a `reply` comment whose own content lives in
      // `payload.text` — the same shape Inbox V3 sends — not a `file_attachment`
      // with the quote bolted on, which the SDK has nowhere to keep.
      const isReply = Boolean(repliedComment);
      const commentType = isReply ? 'reply' : 'file_attachment';
      const messageText = isReply
        ? replyFileMessage(repliedComment, url, commentText)
        : commentText;
      const commentPayload = isReply
        ? buildReplyPayload(repliedComment, commentText, caption)
        : attachmentPayload;
      const commentExtras = isReply
        ? withChannelReplyRef(extras, repliedComment)
        : extras;

      core.sendComment(
        roomId,
        messageText,
        uniqueId,
        commentType,
        JSON.stringify(commentPayload),
        commentExtras
      )
        .then((res) => {
          core.options.sentMessageCallback(res);
          core.removeUploadedFile(files[0].name, roomId);
          e.target.value = null;
          window.setTimeout(() => scrollIntoLastElement(core), 0);
        });
    } else {
      toasted.error(failedText);
      core.removeUploadedFile(files[0].name, roomId);
    }
  };
  xhr.onerror = function() {
    toasted.error(failedText);
    core.removeUploadedFile(files[0].name, roomId);
  }
  xhr.send(formData);
  return true;
}

export const uploadEmailAttachment = (file, core, toast) => {
  return new Promise((resolve, reject) => {
    const files = [file];
    const formData = new FormData();
    const roomId = core.selected.id;

    let ext = files[0].name.split('.');
    ext = ext[ext.length - 1] || null;
    if (core.allowedFileTypes && core.allowedFileTypes.indexOf(ext) < 0) {
      toast.error('File uploading failed beacuse file not supported.');
      reject(new Error('File not supported'));
      return;
    }

    if (ext) ext = ext.toLowerCase();
    const filename = files[0].name.split(".");
    filename[filename.length - 1] = ext;

    formData.append('file', files[0], filename.join("."));
    formData.append('token', core.userData.token);
    core.addUploadedFile(files[0].name, roomId);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (uploadEvent) => {
      updateProgress(uploadEvent, files[0].name, core);
    });
    xhr.open('POST', core.uploadURL, true);
    xhr.setRequestHeader('qiscus_sdk_app_id', `${core.AppId}`);
    xhr.setRequestHeader('qiscus_sdk_user_id', `${core.user_id}`);
    xhr.setRequestHeader('qiscus_sdk_token', `${core.userData.token}`);
    xhr.onload = function responseReceived() {
      if (xhr.status === 200) {
        // file(s) uploaded), let's post to comment
        const url = JSON.parse(xhr.response).results.file.url;
        core.removeUploadedFile(files[0].name, roomId);
        resolve(url);
      } else {
        toast.error('File uploading failed');
        core.removeUploadedFile(files[0].name, roomId);
        reject(new Error('Failed upload file'));
      }
    };
    xhr.onerror = function() {
      toast.error('File uploading failed');
      core.removeUploadedFile(files[0].name, roomId);
      reject(new Error('Failed upload file'));
    }
    xhr.send(formData);
  });
}

export const updateProgress = (e, fileName, core) => {
  if (e.lengthComputable) {
    const percentComplete = e.loaded / e.total;
    const fileObject = uploadedFiles(core)
      .find(f => f.name === fileName);
    if (fileObject) fileObject.progress = Math.round(percentComplete * 100);
    // console.log('%s', fileObject.progress);
  }
}

export const uploadedFiles = (core) => {
  if (!core.selected) return [];
  return core.uploadedFiles
    .filter(f => f.roomId === core.selected.id);
}
