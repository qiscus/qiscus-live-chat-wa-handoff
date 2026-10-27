class QiscusTextParser {
  imageLink = /(\b(https?|ftp|file):\/\/\S+\/([A-Z0-9_.%+-]+)(\.png|\.jpg|\.gif|\.jpeg|\.jpeg-large)[-A-Z0-9+&@#/?;%=~_|$!:,.]*)/gi;
  youtubeLink = /https?:\/\/(?:[\w-]+\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:(?:embed|shorts|live|v)\/|\S*?[?&]v=))([\w-]{11})(?=[^\w-]|$)(?![?=&+%\w.-]*(?:['"][^<>]*>|<\/a>))\S*/gi;
  googleIframe = /<p>&lt;iframe src=(&quot;|"|')(https?)(:\/\/(www\.)?google\.com\/maps\/embed\?\S*)(&quot;|'|").*&lt;\/iframe&gt;<\/p>/gi;
  linkPattern = /((?:(?:https?|ftp|file):\/\/|www\.|ftp\.)\S*[\w+&@#/%=~|$])(?![^<]*>)/gi;
  enhLinkPattern = /((?:(?:https?|ftp|file):\/\/|www\.|ftp\.)\S*[\w+&@#/%=~|$])(?![^<]*>)/gi;
  BitbucketNotif = /#bitbucket(\r?\n|\r)([a-z0-9_-]*)( push to )(\S*)( on branch )(\S*)( with commit : )([\s\S]*)( )\[[0-9a-z]*\] \. link to commit : \S*\/([a-z0-9]*)/i;
  DropboxImg = /https?:\/\/(www\.dropbox)\.com\/(\S*)\.(jpeg|jpg|gif|png)\?(dl=[01])/gi;
  DropboxFile = /https?:\/\/(www\.dropbox)\.com\/(\S*)\/(\S*)\.(\S*)\?(dl=[01])/gi;

  replaceTag(tag) {
    const tagsToReplace = {
      '<': '&lt;',
      '>': '&gt;',
    };
    return tagsToReplace[tag] || tag;
  }

  safeTagsReplace(str) {
    if (!str) return str;
    return str.replaceAll(/[<>]/g, this.replaceTag.bind(this));
  }

  escapeText(text) {
    const escaped = this.safeTagsReplace(text);
    if (!escaped) return escaped;
    return escaped.replaceAll('&L', '&amp;L')
      .replaceAll('&G', '&amp;G')
      .replaceAll(/&gt(?!;)/g, '&amp;gt')
      .replaceAll(/&lt(?!;)/g, '&amp;lt');
  }

  // Line breaks become real <br> elements. `white-space: pre-line` draws a raw
  // \n on screen, but iOS WebKit turns it into a space when the selection is
  // copied, so a multi-line bubble pastes as one paragraph (case #1604).
  lineBreaksToHtml(text) {
    return text.replaceAll(/\r\n|\r|\n/g, '<br>');
  }

  // Escape-only variant of parse() for reply quotes: URLs stay plain text (no
  // <a>/YouTube embed, see CommentRender useParser), but tags are still escaped
  // and line breaks still render as <br>.
  parsePlainText(text) {
    const renderedText = this.escapeText(text);
    if (!renderedText) return renderedText;
    return this.lineBreaksToHtml(renderedText);
  }

  parse(text) {
    let renderedText = this.escapeText(text);
    if (!renderedText) return renderedText;
    renderedText = renderedText.replaceAll(this.googleIframe, '<iframe style="border:1px solid #dedede;" width="455" height="320" src="https$3" frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe><br/>');
    // Prepend https:// to scheme-less URLs (e.g. www.youtube.com/...) before the
    // YouTube match, otherwise the youtubeLink regex (which requires https?://) misses them.
    renderedText = this.transformNonHttpUrl(renderedText);
    renderedText = renderedText.replaceAll(this.youtubeLink, '<iframe style="border:1px solid #dedede;" width="455" height="320" src="https://www.youtube-nocookie.com/embed/$1" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>');
    renderedText = this.parseOtpButton(renderedText);
    renderedText = renderedText.replaceAll(this.linkPattern, '<a href="$1" target="_blank">$1</a>');
    // Done last so the link/YouTube patterns still see \n as a word boundary.
    return this.lineBreaksToHtml(renderedText);
  }

  parseSpecial(text) {
    let renderedText = this.safeTagsReplace(text);
    renderedText = renderedText.replaceAll(this.googleIframe, '<iframe style="border:1px solid #dedede;" width="455" height="320" src="https$3" frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe><br/>');
    // Prepend https:// to scheme-less URLs (e.g. www.youtube.com/...) before the
    // YouTube match, otherwise the youtubeLink regex (which requires https?://) misses them.
    renderedText = this.transformNonHttpUrl(renderedText);
    renderedText = renderedText.replaceAll(this.youtubeLink, '<iframe style="border:1px solid #dedede;" width="455" height="320" src="https://www.youtube-nocookie.com/embed/$1" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>');
    renderedText = renderedText.replaceAll(this.linkPattern, '<a href="$1" target="_blank">$1</a>');
    return renderedText;
  }

  // used for email render
  sanitizeHTML(input) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, 'text/html');

    const dangerousTags = ['script', 'iframe', 'object', 'embed'];
    const exceptionsIframe = ':not([data-safe="true"])';
    dangerousTags.forEach((tag) => {
      const tagFil = tag === 'iframe' ? `${tag}${exceptionsIframe}` : tag;
      const elements = doc.querySelectorAll(tagFil);
      elements.forEach((el) => {
        const stringEl = el.outerHTML;
        const safehtml = document.createElement('div');
        safehtml.innerText = stringEl;
        el.replaceWith(safehtml);
      });
    });

    const dangerousAttributes = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange'];
    doc.body.querySelectorAll('*').forEach((el) => {
      dangerousAttributes.forEach((attr) => {
        if (el.hasAttribute(attr)) {
          el.removeAttribute(attr);
        }
      });
    });

    return doc.body.innerHTML;
  }

  parseForEmail(text) {
    let renderedText = this.safeTagsReplace(text);
    renderedText = renderedText.replaceAll(this.googleIframe, '<iframe data-safe="true" style="border:1px solid #dedede;" width="455" height="320" src="https$3" frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe><br/>');
    // Normalize scheme-less URLs (e.g. www.youtube.com/...) so the youtubeLink regex matches them.
    renderedText = this.transformNonHttpUrl(renderedText, this.enhLinkPattern);
    renderedText = renderedText.replaceAll(this.youtubeLink, '<iframe data-safe="true" style="border:1px solid #dedede;" width="455" height="320" src="https://www.youtube-nocookie.com/embed/$1" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>');
    renderedText = renderedText.replaceAll('&L', '&amp;L')
      .replaceAll('&G', '&amp;G')
      .replaceAll(/&gt(?!;)/g, '&amp;gt')
      .replaceAll(/&lt(?!;)/g, '&amp;lt');
    renderedText = renderedText
      .replaceAll('&amp;lt;', '<')
      .replaceAll('&amp;gt;', '>')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
    renderedText = this.transformNonHttpUrl(renderedText, this.enhLinkPattern);
    renderedText = renderedText.replaceAll(this.enhLinkPattern, '<a href="$1" target="_blank">$1</a>');
    return this.sanitizeHTML(renderedText);
  }

  transformNonHttpUrl(text, customRegex = null) {
    let transformedText = text;
    const httpUrls = transformedText.match(customRegex || this.linkPattern);
    if (!httpUrls) return transformedText;
    httpUrls.forEach((txt) => {
      const httpUrl = (txt.slice(0, 4) === 'http') ? txt : `https://${txt}`;
      transformedText = transformedText.replaceAll(txt, httpUrl).replaceAll('https://https://', 'https://');
    });
    return transformedText;
  }

  parseOtpButton(text) {
    const waOtpURL = 'https://www.whatsapp.com/otp/code/';
    const isWaOTP = text.includes(waOtpURL);

    if (!isWaOTP) return text;

    let newText = text;
    const splitText = text.split(' ');
    const findIdxOtp = splitText.findIndex(txt => txt.includes(waOtpURL));

    if (findIdxOtp >= 0) {
      splitText[findIdxOtp] = 'Button';
      if (splitText[findIdxOtp + 1]) splitText[findIdxOtp + 1] = '';
      if (splitText[findIdxOtp + 2]) splitText[findIdxOtp + 2] = '';

      newText = splitText.join(' ');
    }

    return newText;
  }
}


module.exports = new QiscusTextParser();
