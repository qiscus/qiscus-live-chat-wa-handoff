const MESSAGES = Object.freeze({
  en: Object.freeze({
    'chat.end': 'End chat',
    'chat.ending': 'Ending...',
    'chat.endFailed': "We couldn't end the chat. Please try again.",
    'chat.ended': 'This chat has ended',
    'chat.openError': 'Error opening chatroom',
    'chat.retry': 'Try again',
    'status.online': 'Online',
    'status.offline': 'Offline',
    'participants.count': '{count} participants',
    'participants.others': 'and {count} others.',
    'composer.placeholder': 'Send a message ...',
    'common.preview': 'Preview',
    'common.sendTo': 'Send to {name}',
    'common.browse': 'Browse',
    'common.change': 'Change',
    'common.caption': 'Add your caption ...',
    'common.captionShort': 'Add caption..',
    'common.noPreview': 'No Preview available',
    'common.imageLoading': 'Loading Image...',
    'common.imageReload': 'Reload Image',
    'common.loadMore': 'Load More',
    'common.firstPage': "You've reached first page",
    'common.downloadFile': 'Download File',
    'common.addImage': 'Add more image',
    'upload.hideDetails': 'Hide details',
    'upload.showDetails': 'Show details',
    'upload.onQueue': 'On queue',
    'upload.sending': 'Sending',
    'upload.progress': 'Uploading {progress}%',
    'upload.success': 'Success',
    'upload.failedStatus': 'Failed',
    'upload.failed': '{count} media(s) failed to send.',
    'upload.retry': 'Try again',
    'upload.dropzone': 'Drag file here for upload...',
    'upload.fileFailed': 'File uploading failed',
    'echo.whatsapp': 'This message was sent from the WhatsApp app.',
    'echo.tiktok': 'This message was sent from the Tiktok app.',
    'common.cancel': 'Cancel',
    'file.open': 'Yes, open it',
    'file.confirmOpen': 'Are you sure you want to open this file? Make sure you trust it before opening it.',
    'file.audioUnsupported': 'Your browser does not support the audio element.',
    'file.videoUnsupported': "Sorry, your browser doesn't support embedded videos.",
    'file.blocked': "Sorry, {filename} can't be opened because the .{ext} file type isn't allowed and has been temporarily blocked. Please contact your administrator to have this file type allowlisted.",
    'message.failed': 'Message failed to send.',
    'message.reply': 'Reply',
    'reply.replyingTo': 'Replying to {name}',
    'message.notLoaded': 'Comment not loaded yet, load more to go to comment',
    'message.resend': 'Resend',
    'message.resendSuccess': 'Message resent successfully.',
    'message.resendFailed': 'Could not resend the message.',
    'message.redownloadOnce': 'You can only download this attachment once.',
    'message.downloadSuccess': 'File downloaded successfully.',
    'message.downloadFailed': 'Could not download the file.',
    'message.info': 'Message Info',
    'message.readBy': 'Read By',
    'message.deliveredTo': 'Delivered To',
    'ai.thinking': 'Thinking ...',
    'email.clearAll': 'Clear all',
    'email.sendNow': 'Send Now',
  }),
  id: Object.freeze({
    'chat.end': 'Akhiri chat',
    'chat.ending': 'Mengakhiri...',
    'chat.endFailed': 'Chat tidak dapat diakhiri. Silakan coba lagi.',
    'chat.ended': 'Chat ini telah berakhir',
    'chat.openError': 'Gagal membuka ruang chat',
    'chat.retry': 'Coba lagi',
    'status.online': 'Online',
    'status.offline': 'Tidak aktif',
    'participants.count': '{count} peserta',
    'participants.others': 'dan {count} lainnya.',
    'composer.placeholder': 'Kirim pesan ...',
    'common.preview': 'Pratinjau',
    'common.sendTo': 'Kirim ke {name}',
    'common.browse': 'Pilih file',
    'common.change': 'Ganti',
    'common.caption': 'Tambahkan keterangan ...',
    'common.captionShort': 'Tambah keterangan..',
    'common.noPreview': 'Pratinjau tidak tersedia',
    'common.imageLoading': 'Memuat gambar...',
    'common.imageReload': 'Muat ulang gambar',
    'common.loadMore': 'Muat lebih banyak',
    'common.firstPage': 'Anda sudah mencapai halaman pertama',
    'common.downloadFile': 'Unduh file',
    'common.addImage': 'Tambah gambar',
    'upload.hideDetails': 'Sembunyikan detail',
    'upload.showDetails': 'Tampilkan detail',
    'upload.onQueue': 'Dalam antrean',
    'upload.sending': 'Mengirim',
    'upload.progress': 'Mengunggah {progress}%',
    'upload.success': 'Berhasil',
    'upload.failedStatus': 'Gagal',
    'upload.failed': 'Gagal mengirim {count} media.',
    'upload.retry': 'Coba lagi',
    'upload.dropzone': 'Seret file ke sini untuk mengunggah...',
    'upload.fileFailed': 'File gagal diunggah',
    'echo.whatsapp': 'Pesan ini dikirim dari aplikasi WhatsApp.',
    'echo.tiktok': 'Pesan ini dikirim dari aplikasi Tiktok.',
    'common.cancel': 'Batal',
    'file.open': 'Ya, buka',
    'file.confirmOpen': 'Apakah Anda yakin ingin membuka file ini? Pastikan Anda memercayai file tersebut sebelum membukanya.',
    'file.audioUnsupported': 'Browser Anda tidak mendukung pemutar audio.',
    'file.videoUnsupported': 'Maaf, browser Anda tidak mendukung video tersemat.',
    'file.blocked': 'Maaf, {filename} tidak dapat dibuka karena file .{ext} tidak diizinkan dan diblokir sementara. Untuk melihat file ini, jenis file tersebut harus diizinkan. Hubungi administrator Anda untuk informasi lebih lanjut.',
    'message.failed': 'Pesan gagal dikirim.',
    'message.reply': 'Balas',
    'reply.replyingTo': 'Membalas {name}',
    'message.notLoaded': 'Komentar belum dimuat. Muat lebih banyak untuk melihat komentar.',
    'message.resend': 'Kirim ulang',
    'message.resendSuccess': 'Pesan berhasil dikirim ulang.',
    'message.resendFailed': 'Pesan gagal dikirim ulang.',
    'message.redownloadOnce': 'Lampiran ini hanya dapat diunduh sekali.',
    'message.downloadSuccess': 'File berhasil diunduh.',
    'message.downloadFailed': 'File tidak dapat diunduh.',
    'message.info': 'Info pesan',
    'message.readBy': 'Dibaca oleh',
    'message.deliveredTo': 'Dikirim ke',
    'ai.thinking': 'Sedang berpikir...',
    'email.clearAll': 'Hapus semua',
    'email.sendNow': 'Kirim sekarang',
  }),
});

function getCustomerLocale(localeOption, browserLanguage) {
  if (localeOption === 'en' || localeOption === 'id') return localeOption;
  if (localeOption !== 'auto') return 'en';
  const languages = typeof browserLanguage === 'string'
    ? [browserLanguage]
    : Array.isArray(browserLanguage) ? browserLanguage : [];
  for (const language of languages) {
    if (typeof language !== 'string') continue;
    if (/^id(?:[-_]|$)/i.test(language)) return 'id';
    if (/^en(?:[-_]|$)/i.test(language)) return 'en';
  }
  return 'en';
}

function customerText(key, localeOption, browserLanguage, values) {
  const locale = getCustomerLocale(localeOption, browserLanguage);
  const text = MESSAGES[locale][key] || MESSAGES.en[key] || key;
  const params = values || {};
  return text.replace(/\{(\w+)\}/g, (placeholder, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder
  ));
}

module.exports = { MESSAGES, customerText, getCustomerLocale };
