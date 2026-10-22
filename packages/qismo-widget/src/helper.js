export const _ = (el) => document.querySelector(el);
export const __ = (el) => document.querySelectorAll(el);
export const qiscusApp = (() => {
    try {
        return window.parent && window.parent.qiscusApp ? window.parent.qiscusApp : null;
    } catch { return null }
})();
export const removeClass = (el, classname) => (el) ? el.classList.remove(classname) : null;
export const toggleClass = (el, className) => {
    if (!el) return false;
    if (el.classList) {
        el.classList.toggle(className);
    } else {
        var classes = el.className.split(' ');
        var existingIndex = classes.indexOf(className);

        if (existingIndex >= 0)
            classes.splice(existingIndex, 1);
        else
            classes.push(className);

        el.className = classes.join(' ');
    }
}
export const fadeIn = (el, callback) => {
    if (!el) return;
    var transformValue = 15;
    el.style.opacity = 0;
    el.style.transform = 'translateY(15px)';

    var last = +new Date();
    var tick = function () {
        el.style.opacity = +el.style.opacity + (new Date() - last) / 400;
        transformValue = transformValue - 1;
        if (transformValue < 15) {
            el.style.transform = 'translateY(' + transformValue + 'px)';
        }
        if (transformValue <= 0 || el.style.opacity >= 1) {
            el.style.transform = 'none';
            el.style.opacity = 1;
        }
        last = +new Date();

        if (+el.style.opacity < 1) {
            (window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
        } else {
            el.style.display = 'block';
            if (callback) callback();
        }
    };

    tick();
}
export const fadeOut = (el, callback) => {
    if (!el) return;
    var transformValue = 0;
    el.style.opacity = 1;
    el.style.transform = 'translateY(0px)';

    var last = +new Date();
    var tick = function () {
        el.style.opacity = +el.style.opacity - (new Date() - last) / 400;
        transformValue = transformValue + 1;
        el.style.transform = 'translateY(' + transformValue + 'px)';
        last = +new Date();

        if (+el.style.opacity > 0) {
            (window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
        }

        if (el.style.opacity <= 0) {
            el.style.display = 'none';
            if (callback) callback();
        }
    };

    tick();
}
export const removeElement = (el) => (el) ? el.parentNode.removeChild(el) : false;
export const _ajax = (opts) => {
    var request = new XMLHttpRequest();
    var formData = '';


    return new Promise(function (resolve, reject) {
        request.onload = function () {
            if (this.status >= 200 && this.status < 400) {
                resolve(opts.successFn(JSON.parse(this.response)));
            } else {
                reject(opts.failFn(JSON.parse(this.response)));
            }
        };
        request.onerror = function () {
            reject(opts.failFn());
        };
        request.open(opts.type || 'GET', opts.url, true);
        if (opts.appVersion) {
            request.setRequestHeader('App-Version', opts.appVersion);
        }
        if (opts.type == 'POST') {
            request.setRequestHeader('Content-type', 'application/json; charset=utf-8');

            if (opts.data) {
                formData = JSON.stringify(opts.data);
            }
        }

        request.send(formData || null);
    });
}
export const generateDefaultConfig = (staging, options) => ({
    customerServiceAvatar: null,
    welcomeMessageStatus: true,
    welcomeBrandIcon: "https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/qismo/icon_brand_qiscus.svg",
    welcomeGreetingText: "Hello there,",
    welcomeText: "Welcome to Qiscus!",
    welcomeActionIcon: "https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/qismo/icon_chat_black.svg",
    welcomeActionDescription: "Ask for Questions",
    welcomeTimeout: 3,
    attentionGrabberImage: "https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/qismo/bg_default_attention_grabber.png",
    attentionGrabberText: 'Hello, there is Promo!',
    grabberImage: true,
    grabberTextStatus: true,
    customerServiceName: "Hello there,",
    buttonHasText: true,
    buttonText: "Start Chat",
    buttonHasIcon: "true",
    buttonCloseIcon: "https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/qismo/icon-qiscus-widget-close.svg",
    buttonIcon: "https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/qismo/icon-qiscus-widget-open.svg",
    loginBrandLogo: "https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/qismo/icon-qiscus-widget-open.svg",
    formGreet: "Hello there,",
    formSecondGreet: "Welcome to Qiscus!",
		formSubtitle: "Please fill the details below before chatting with us!",
    customerIdentifierInputType: "email",
		extra_fields: null,
    openAtStart: false,
    qismoBaseUrl:
        options && options.baseUrl
            ? options.baseUrl
            : staging
                ? "https://qismo-stag4.qiscus.io"
                : "https://qismo.qiscus.com",
    qismoIframeUrl:
        options && options.qismoIframeUrl
            ? options.qismoIframeUrl
            : "https://omnichannel.qiscus.com",
    callbackFunction: {
        afterFormValidation: false,
    },
    customerIdentifier: "email",
    isChannelWidgetEnabled: false,
    selectedWidgetPage: "Welcome to Qiscus!",
    colorWidget: "#01416c",
});
export const setDefaultConfig = (data, options) => {
    var initialValue = generateDefaultConfig();
    initialValue.qismoBaseUrl = (options && options.baseUrl) ? options.baseUrl : '//multichannel.qiscus.com';
    initialValue.qismoIframeUrl = (options && options.qismoIframeUrl) ? options.qismoIframeUrl : '//multichannel.qiscus.com';
    if (!window.qismoConfig) window.qismoConfig = Object.assign({}, initialValue);
    if (options) window.qismoConfig = Object.assign({}, qismoConfig, options);
    if (!data) {
        qismoConfig = Object.assign({}, initialValue, qismoConfig);
        return qismoConfig;
    }
    if (data.variables) {
        if (qiscusApp && qiscusApp.overrideObjChannel) {
            Object.keys(qiscusApp.overrideObjChannel).forEach(function (key) {
                qismoConfig[key] = qiscusApp.overrideObjChannel[key];
            });
        }
        Object.keys(data.variables).map(function (key) {
            qismoConfig[key] = data.variables[key];
        });
        qismoConfig['buttonCloseIcon'] = initialValue.buttonCloseIcon;
    }
}
export const attachQismoCustomCSS = (style) => {
    if (!style) {
        _('head').appendChild(createNode('style', '.qcw-header { background: #74c162 !important; }'));
        return false;
    }
    var cssstring = Object.keys(style).reduce(function (previous, key) {
        return previous + key + JSON.stringify(style[key]).replace(/['"]+/g, '').replace(/[,]+/g, ';');
    }, '');
    // get base color
    var baseBgColor = '#74c162';
    var baseTextColor = '#FFFFFF';
    // override basebgcolor if it's being set on dashboard
    if (style['.qcw-header,.qismo-login-form__header']) {
        baseBgColor = style['.qcw-header,.qismo-login-form__header']['background-color'].replace('!important', '').trim();
        baseTextColor = '#444444';
        if (baseBgColor.toLowerCase() == '#ffffff') {
            cssstring += '.qismo-contact-icon,.qismo-email-icon{fill:' + baseBgColor + ';}';
            cssstring += '.qismo-phone-icon{stroke:' + baseBgColor + ';}';
            cssstring += '.qismo-input .icon{background:' + convertHex('#444444', 20) + '!important;}';
            cssstring += '.qcw-copyright,.qismo-input input {color:#444 !important;}';
            cssstring += '.qismo-login-form__header { color: ' + baseTextColor + ';}';
            cssstring += '.qcw-cs-box-form { background: #444; }';
            cssstring += '.qcw-cs-back { color: ' + baseTextColor + ';}';
        } else {
            cssstring += '.qismo-contact-icon,.qismo-email-icon{fill:' + baseBgColor + ';}';
            cssstring += '.qismo-phone-icon{stroke:' + baseBgColor + ';}';
            cssstring += '.qismo-input .icon{background:' + convertHex(baseBgColor, 20) + '!important;}';
            cssstring += '.qcw-copyright,.qismo-copyright,.qismo-input input {color:' + baseBgColor + '!important;}';
        }
    }
    // if(!qismoConfig.buttonHasIcon) cssstring += '.qcw-trigger-btn img { display:none;}';

    !document.querySelector('#qismo-custom-css') && _('head').appendChild(createNode('style', cssstring, { id: 'qismo-custom-css' }));
    return cssstring;
}

function hexToRgb(hex) {
    // turn hex val to RGB
    var rgx = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
    var result = rgx.exec(hex);
    return {
        r: parseInt(rgx.exec(hex)[1], 16),
        g: parseInt(rgx.exec(hex)[2], 16),
        b: parseInt(rgx.exec(hex)[3], 16)
    }
}

// calc to work out if it will match on black or white better
function setContrast(rgb) {
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? '#444' : '#FFF';
}

export const convertHex = (hex, opacity = 100) => {
    if (!hex || typeof hex !== 'string') return 'rgba(0,0,0,1)';
    hex = hex.replace('#', '');
    if (hex.length !== 6) return 'rgba(0,0,0,1)';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const alpha = typeof opacity === 'number' && opacity >= 0 && opacity <= 100 ? opacity / 100 : 1;
    return `rgba(${r},${g},${b},${alpha})`;
}
const createNode = (el, content, attr) => {
    var node = document.createElement(el);
    if (content) node.appendChild(document.createTextNode(content));
    if (attr) {
        var nodeAttr = '';
        Object.keys(attr).forEach(function (a) {
            nodeAttr = document.createAttribute(a);
            nodeAttr.value = attr[a];
            node.setAttributeNode(nodeAttr);
        })
    }
    return node;
}
export const parseUrlParams = (obj) => {
    let parameters = '';
    Object.keys(obj).forEach(o => {
        let prefix = '&';
        if (!parameters) prefix = '?';
        parameters += `${prefix}${o}=${obj[o]}`
    });
    return parameters;
}
