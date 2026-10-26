<svelte:options accessors />

<script>
  import QiscusTriggerBtn from "./components/qiscus-trigger-btn.svelte";
  import { onMount } from "svelte";
  import aes from "crypto-js/aes";

  import {
    _ajax,
    generateDefaultConfig,
    setDefaultConfig,
    attachQismoCustomCSS,
    parseUrlParams,
    fadeIn,
    fadeOut,
    qiscusApp,
    convertHex,
  } from "./helper.js";
  /*
    What's need to be done:
    - Load Qismo config from api
    - Render trigger button based on qismo config
    - Render Welcome message if any
    - Render Attention Grabber if any
    */
  window.qismoConfig = {};
  let isInitiated = false;
  let isLogin = false;
  let defaultConfig = {};
  let isWelcomeMessageOpened = false;
  let isAttentionGrabber = false;
  let isLoginFormOpened = false;
  let isWidgetOpened = false;
  let isMobile = false;
  let userData;
  let loginFormIframe;
  let welcomeMessageIframe;
  let attentionGrabberIframe;
  let channelsIframe;
  let widgetIframe;
  let customcss;
  let whitelabelcss = "";

  // btn
  let showBtnWelcome = false;

  // widget channel
  let channelFormIframe;
  let isChannelFormOpened = false;
  let isFromChannelForm = false;
  let isFromPreviousForm = false;
  let breakpoint = null;

  export let isOpenedIframe = false;
  export let staging = false;
  export let widgetDesktopSizes = [424, 580];
  export let loginFormSizes = [424, 720];
  export let channelFormSizes = [424, 720];
  export let welcomeMessageSizes = [424, 500];
  export let grabberSizes = [424, 510];

  const loadQismo = () => {
    defaultConfig = generateDefaultConfig(staging, options);
    _ajax({
      type: "GET",
      url: `${defaultConfig.qismoBaseUrl}/api/v2/app/config/public-widget/${appId}/${options.channel_id}`,
      appVersion: `${options.appVersion}`,
      successFn: function (res) {
        const data = res.data.widget;

        setDefaultConfig(data, options);
        customcss = attachQismoCustomCSS(data ? data.styles : null);

        // Bersihkan localStorage jika data tidak lengkap
        const ls = JSON.parse(localStorage.getItem("qismo-widget"));
        if (ls && (!ls.display_name || !ls.unique_id))
          localStorage.removeItem("qismo-widget");

        isLogin = !!localStorage.getItem("qismo-widget");
        isWelcomeMessageOpened = qismoConfig.welcomeMessageStatus && !isLogin;

        if (qismoConfig.attentionGrabberStatus && !isLogin) {
          isAttentionGrabber = true;
          renderAttentionGrabber();
        }

        renderWelcomeMessage(isWelcomeMessageOpened);
        if (qismoConfig.isChannelWidgetEnabled) {
          if (isLogin) {
            if (!qismoConfig.openAtStart) {
              userData = {
                display_name: ls.display_name,
                unique_id: ls.unique_id,
                extra_fields: ls.extra_fields,
              };
              renderQiscusWidget(true);
            } else {
              toggleQiscusWidget();
            }
          } else {
            if (qismoConfig.openAtStart && !isWelcomeMessageOpened) {
              renderChannelForm();
            }
          }
        } else {
          if (isLogin) {
            userData = {
              display_name: ls.display_name,
              unique_id: ls.unique_id,
              extra_fields: ls.extra_fields,
            };
            renderQiscusWidget();
          } else {
            renderLoginForm();
          }
        }
        isInitiated = true;
        setMobileView();
      },
      failFn: function (err) {},
    });
  };
  const renderAttentionGrabber = () => {
    attentionGrabberIframe = document.createElement("iframe");
    let timeout = qismoConfig.grabberTimeout * 1000 || 0;
    let params = parseUrlParams({
      attention_grabber_image: qismoConfig.attentionGrabberImage,
      attention_grabber_text: qismoConfig.attentionGrabberText,
      is_grabber_image: qismoConfig.grabberImage,
      is_grabber_text: qismoConfig.grabberTextStatus,
    });
    if (customcss) params += `&customcss=${customcss.replace(/#/g, "@")}`;
    let iframeSource = `${qismoConfig.qismoIframeUrl}/iframes/v5/${appId}/attention-grabber${params}`;
    attentionGrabberIframe.setAttribute("src", iframeSource);
    attentionGrabberIframe.setAttribute("id", "qcw-attention-grabber-iframe");
    attentionGrabberIframe.setAttribute("style", "display: none");

    if (document.body.clientWidth < breakpoint || isMobile) {
      changeIframeSize(attentionGrabberIframe, "100%", "100%", "0", "4px");
    } else {
      changeIframeSize(
        attentionGrabberIframe,
        grabberSizes[0] + "px",
        grabberSizes[1] + "px",
        "-12px",
        "68px",
      );
    }
    if (!document.getElementById("qcw-welcome-iframe"))
      document.body.appendChild(attentionGrabberIframe);

    setTimeout(() => {
      isAttentionGrabber = true;
      fadeIn(attentionGrabberIframe);
    }, timeout);
  };
  const renderWelcomeMessage = (isWelcomeOpened = true) => {
    var timeout =
      qismoConfig.welcomeTimeout >= 0
        ? qismoConfig.welcomeTimeout
        : defaultConfig.welcomeTimeout;
    welcomeMessageIframe = document.createElement("iframe");
    let params = parseUrlParams({
      brand_icon: qismoConfig.welcomeBrandIcon,
      greeting_text: qismoConfig.welcomeGreetingText,
      welcome_text: qismoConfig.welcomeText,
      action_icon: qismoConfig.welcomeActionIcon,
      action_desc: qismoConfig.welcomeActionDescription,
      color_widget: convertHex(qismoConfig.colorWidget, 100),
    });
    let iframeSource = `${qismoConfig.qismoIframeUrl}/iframes/v5/${appId}/welcome-message${params}`;
    welcomeMessageIframe.setAttribute("src", iframeSource);
    welcomeMessageIframe.setAttribute("id", "qcw-welcome-iframe");
    welcomeMessageIframe.setAttribute("style", "display: none");
    if (document.body.clientWidth < breakpoint || isMobile) {
      changeMobileIframeSize(welcomeMessageIframe);
    } else {
      changeIframeSize(
        welcomeMessageIframe,
        welcomeMessageSizes[0] + "px",
        welcomeMessageSizes[1] + "px",
        "-12px",
        "68px",
      );
    }
    if (!document.getElementById("qcw-welcome-iframe"))
      document.body.appendChild(welcomeMessageIframe);

    if (!isWelcomeOpened) return;
    setTimeout(
      () => {
        welcomeMessageIframe.style.display = "block";
        showBtnWelcome = true;
        isOpenedIframe = true;
        isWelcomeMessageOpened = true;
        fadeIn(welcomeMessageIframe);
      },
      parseInt(timeout) * 1000,
    );
  };
  export const toggleLoginForm = () => {
    if (isLogin) return false;
    isLoginFormOpened = !isLoginFormOpened;
    const el = document.getElementById("qcw-login-form-iframe");
    if (!el) renderLoginForm();
    if (el && typeof el == "object") {
      if (isLoginFormOpened) {
        fadeIn(el, () => {
          setTimeout(() => {
            isOpenedIframe = true;
            if (customcss)
              sendMessage("qcw-login-form-iframe", {
                event_name: "custom-css",
                css: customcss,
              });
            if (options && options.extra_fields)
              sendMessage("qcw-login-form-iframe", {
                event_name: "extra-fields",
                extra_fields: JSON.stringify(options.extra_fields),
              });
          }, 0);
        });
      } else {
        fadeOut(el);
        isOpenedIframe = false;
        if (qismoConfig.welcomeMessageStatus) {
          showBtnWelcome = true;
        }
      }
    }
  };
  export const toggleChannelForm = () => {
    isChannelFormOpened = !isChannelFormOpened;
    channelsIframe = document.getElementById("qcw-channel-form-iframe");
    const widget = qismoConfig.channel_widget;
    if (!channelsIframe) renderChannelForm();
    if (channelsIframe && typeof channelsIframe == "object") {
      if (isChannelFormOpened) {
        fadeIn(channelsIframe, () => {
          isOpenedIframe = true;
          setTimeout(() => {
            if (customcss)
              sendMessage("qcw-channel-form-iframe", {
                event_name: "custom-css",
                css: customcss,
              });
            if (widget)
              sendMessage("qcw-channel-form-iframe", {
                event_name: "widget",
                widget: JSON.stringify(widget),
              });
          }, 0);
        });
      } else {
        fadeOut(channelsIframe);
        isOpenedIframe = false;
        if (qismoConfig.welcomeMessageStatus) {
          showBtnWelcome = true;
        }
      }
    }
  };
  export const toggleWelcomeMessage = () => {
    if (attentionGrabberIframe && isAttentionGrabber) {
      closeAttentionGrabber();
      if (qismoConfig.welcomeMessageStatus) {
        isWelcomeMessageOpened = false;
      }
    } else {
      if (welcomeMessageIframe) {
        isWelcomeMessageOpened = !isWelcomeMessageOpened;
        if (isWelcomeMessageOpened) {
          openWelcomeMessage();
        } else {
          if (isLoginFormOpened) {
            toggleLoginForm();
          }
          closeWelcomeMessage();
        }
      } else {
        renderWelcomeMessage();
        isWelcomeMessageOpened = true;
      }
    }
  };
  export const toggleWidget = () => {
    const isLoggedIn = !!localStorage.getItem("qismo-widget");
    closeAttentionGrabber();
    showBtnWelcome = false;
    const shouldShowChannel =
      qismoConfig.isChannelWidgetEnabled &&
      !isWelcomeMessageOpened &&
      !isLoginFormOpened &&
      !isWidgetOpened &&
      !isLoggedIn;

    if ((isChannelFormOpened || shouldShowChannel) && !isFromChannelForm) {
      toggleChannelForm();
    } else if (
      (isLoginFormOpened && qismoConfig.isChannelWidgetEnabled) ||
      qismoConfig.welcomeMessageStatus
    ) {
      if (isLoggedIn) {
        isWidgetOpened = !isWidgetOpened;
        if (isWidgetOpened) {
          isOpenedIframe = true;
          showBtnWelcome = false;
          window.postMessage({ event_name: "maximize-widget" });
          fadeIn(widgetIframe);
        } else {
          window.postMessage({ event_name: "minimize-widget" });
          fadeOut(widgetIframe);
          isOpenedIframe = false;
          // if (qismoConfig.welcomeMessageStatus) {
          //   showBtnWelcome = true;
          // }
        }
      } else {
        if (qismoConfig.isChannelWidgetEnabled) {
          isFromChannelForm = false;
        }
        toggleLoginForm();
      }
    } else if (
      !qismoConfig.isChannelWidgetEnabled &&
      !qismoConfig.welcomeMessageStatus &&
      !isChannelFormOpened &&
      !isWelcomeMessageOpened &&
      !isWidgetOpened
    ) {
      if (isLoggedIn) {
        if (
          qismoConfig.attentionGrabberStatus &&
          !qismoConfig.openAtStart &&
          !isAttentionGrabber
        ) {
          openQiscusWidget();
        } else {
          toggleQiscusWidget();
        }
      } else {
        toggleLoginForm();
      }
    } else if (isLoggedIn) {
      if (qismoConfig.isChannelWidgetEnabled) {
        isFromChannelForm = false;
      }
      toggleQiscusWidget();
    }
  };
  export const openNextIframe = () => {
    closeWelcomeMessage();
    isInitiated = true;

    if (!isLogin && !localStorage.getItem("qismo-widget")) {
      if (qismoConfig.isChannelWidgetEnabled) {
        toggleChannelForm();
      } else {
        toggleLoginForm();
      }
    } else {
      if (qismoConfig.isChannelWidgetEnabled) {
        toggleChannelForm();
      } else {
        showBtnWelcome = false;
        isOpenedIframe = true;
        if (isWidgetOpened) {
          isWidgetOpened = false;
          window.postMessage({ event_name: "minimize-widget" });
          fadeOut(widgetIframe);
        } else {
          openQiscusWidget();
        }
      }
    }
    showBtnWelcome = false;
  };
  export const openNextForm = () => {
    isChannelFormOpened = false;
    isFromChannelForm = true;
    isFromPreviousForm = false;
    isOpenedIframe = true;

    let ls = JSON.parse(localStorage.getItem("qismo-widget"));
    if (!ls) {
      isLoginFormOpened = true;
      if (loginFormIframe && typeof loginFormIframe == "object") {
        setTimeout(() => {
          fadeIn(loginFormIframe, () => {
            if (customcss)
              sendMessage("qcw-login-form-iframe", {
                event_name: "custom-css",
                css: customcss,
              });
            if (options && options.extra_fields)
              sendMessage("qcw-login-form-iframe", {
                event_name: "extra-fields",
                extra_fields: JSON.stringify(options.extra_fields),
              });
          });
        }, 1000);
      } else {
        renderLoginForm();
      }
    } else {
      showBtnWelcome = false;

      if (!isWidgetOpened) {
        widgetIframe = document.getElementById("qcw-iframe");
        if (widgetIframe) {
          isWidgetOpened = true;
          window.postMessage({ event_name: "maximize-widget" });
          fadeIn(widgetIframe);
        } else {
          isWidgetOpened = false;
          if (!ls) return;
          userData = {
            display_name: ls.display_name,
            unique_id: ls.unique_id,
            extra_fields: ls.extra_fields,
          };
          renderQiscusWidget(true);
        }
      }
    }

    fadeOut(channelFormIframe);
  };
  export const openPreviousIframe = () => {
    if (isChannelFormOpened) {
      isChannelFormOpened = false;
      channelsIframe = document.getElementById("qcw-channel-form-iframe");
      fadeOut(channelsIframe);
      if (qismoConfig.welcomeMessageStatus) {
        isOpenedIframe = true;
        showBtnWelcome = true;
        openWelcomeMessage();
      }
    }
  };
  export const openPreviousForm = () => {
    isChannelFormOpened = true;
    isFromChannelForm = false;
    isFromPreviousForm = true;
    if (qiscusApp) qiscusApp.selectedNav = "channel";

    const elmChannelFormIframe = document.getElementById(
      "qcw-channel-form-iframe",
    );

    if (elmChannelFormIframe && typeof elmChannelFormIframe == "object") {
      const widget = qismoConfig.channel_widget;
      isOpenedIframe = true;
      setTimeout(() => {
        fadeIn(elmChannelFormIframe, () => {
          isOpenedIframe = true;
          if (customcss)
            sendMessage("qcw-channel-form-iframe", {
              event_name: "custom-css",
              css: customcss,
            });
          if (widget)
            sendMessage("qcw-channel-form-iframe", {
              event_name: "widget",
              widget: JSON.stringify(widget),
            });
        });
      }, 1000);
    } else {
      renderChannelForm();
    }

    if (!localStorage.getItem("qismo-widget")) {
      isLoginFormOpened = false;
      isOpenedIframe = false;
      fadeOut(loginFormIframe);
      setTimeout(() => {
        sendMessage("qcw-login-form-iframe", { event_name: "reset-form" });
      }, 500);
    } else {
      isWidgetOpened = false;
      isOpenedIframe = false;
      window.postMessage({ event_name: "minimize-widget" });
      fadeOut(widgetIframe);
    }
  };
  export const login = (data) => {
    let ls = JSON.parse(localStorage.getItem("qismo-widget"));
    if (ls) {
      userData = {
        display_name: ls.display_name,
        unique_id: ls.unique_id,
        extra_fields: ls.extra_fields,
      };
    } else {
      isLogin = true;
      isLoginFormOpened = true;
      userData = data;
      if (options && options.extra_fields)
        userData.extra_fields = data.extra_fields;
      localStorage.setItem("qismo-widget", JSON.stringify(userData));
    }
    if (qiscusApp) qiscusApp.selectedNav = "chat";
    isChannelFormOpened = false;
    const el = document.getElementById("qcw-login-form-iframe");
    if (el) fadeOut(el);
    renderQiscusWidget();
  };
  const toggleQiscusWidget = () => {
    const el = document.getElementById("qcw-iframe");
    if (!el) return login();
    isWidgetOpened = !isWidgetOpened;
    if (isWidgetOpened) {
      isOpenedIframe = true;
      showBtnWelcome = false;
      window.postMessage({ event_name: "maximize-widget" });
      fadeIn(el);
    } else {
      window.postMessage({ event_name: "minimize-widget" });
      fadeOut(el);
      isOpenedIframe = false;
      if (qismoConfig.welcomeMessageStatus) {
        showBtnWelcome = true;
      }
    }
  };
  const openQiscusWidget = () => {
    widgetIframe = document.getElementById("qcw-iframe");
    if (widgetIframe) {
      isOpenedIframe = true;
      isWidgetOpened = true;
      window.postMessage({ event_name: "maximize-widget" });
      fadeIn(widgetIframe);
    } else {
      const ls = JSON.parse(localStorage.getItem("qismo-widget"));
      if (!ls) return;
      userData = {
        display_name: ls.display_name,
        unique_id: ls.unique_id,
        extra_fields: ls.extra_fields,
      };
      renderQiscusWidget(true);
    }
  };
  export const openWelcomeMessage = () => {
    const elmWelcomeMessage = document.getElementById("qcw-welcome-iframe");
    if (elmWelcomeMessage && typeof elmWelcomeMessage == "object") {
      isOpenedIframe = true;
      isWelcomeMessageOpened = true;
      setTimeout(() => {
        fadeIn(elmWelcomeMessage);
      }, 100);
    }
  };
  export const closeWelcomeMessage = () => {
    const elmWelcomeMessage = document.getElementById("qcw-welcome-iframe");
    if (elmWelcomeMessage && typeof elmWelcomeMessage == "object") {
      isOpenedIframe = false;
      isWelcomeMessageOpened = false;
      elmWelcomeMessage.style.display = "none";
      setTimeout(() => {
        fadeOut(elmWelcomeMessage);
      }, 100);
    }
  };
  export const closeAttentionGrabber = () => {
    if (attentionGrabberIframe) {
      isAttentionGrabber = false;
      fadeOut(attentionGrabberIframe);
    }
  };
  export const closeChannelForm = () => {
    isChannelFormOpened = false;
    if (channelsIframe) fadeOut(channelsIframe);
  };
  var sendMessage = function (el, msg) {
    // Make sure you are sending a string, and to stringify JSON
    document.getElementById(el).contentWindow.postMessage(msg, "*");
  };
  const renderLoginForm = () => {
    loginFormIframe = document.createElement("iframe");
    const customerIdentifier = qismoConfig.customerIdentifierInputType
      ? qismoConfig.customerIdentifierInputType
      : qismoConfig.customerIdentifier || "email";
    let params = parseUrlParams({
      brand_logo: qismoConfig.loginBrandLogo,
      form_greet: qismoConfig.formGreet,
      form_second_greet: qismoConfig.formSecondGreet,
      form_subtitle: qismoConfig.formSubtitle,
      button_label: qismoConfig.loginFormButtonLabel,
      customer_identifier: customerIdentifier,
      extra_fields:
        options && options.extra_fields
          ? JSON.stringify(options.extra_fields)
          : "",
      is_channel_widget_enable: qismoConfig.isChannelWidgetEnabled,
      channel_name: qismoConfig.channel_widget.live_channel.name || "",
      channel_badge: qismoConfig.channel_widget.live_channel.badge_url || "",
      color_widget: convertHex(qismoConfig.colorWidget, 100),
    });

    if (options && options.initialCountryCode)
      params += `&initial_country_code=${options.initialCountryCode}`;
    if (options && options.whitelabel)
      whitelabelcss = `.qismo-copyright{display:none!important;}`;
    let iframeSource = `${qismoConfig.qismoIframeUrl}/iframes/v5/${appId}/login-form${params}`;
    if (qismoConfig.loginFormUrl)
      iframeSource = `${qismoConfig.loginFormUrl}?customerIdentifier=${customerIdentifier}`;
    loginFormIframe.setAttribute("src", iframeSource);
    loginFormIframe.setAttribute("id", "qcw-login-form-iframe");
    loginFormIframe.setAttribute("style", "display: none");
    if (document.body.clientWidth < breakpoint || isMobile) {
      changeMobileIframeSize(loginFormIframe);
    } else {
      changeIframeSize(
        loginFormIframe,
        loginFormSizes[0] + "px",
        loginFormSizes[1] + "px",
      );
    }
    if (!document.getElementById("qcw-login-form-iframe"))
      document.body.appendChild(loginFormIframe);

    if (isFromChannelForm) {
      closeWelcomeMessage();
      isOpenedIframe = true;
      isLoginFormOpened = true;
      setTimeout(() => {
        fadeIn(loginFormIframe, () => {
          if (customcss) {
            sendMessage("qcw-login-form-iframe", {
              event_name: "custom-css",
              css: customcss,
            });
          }
          if (options && options.extra_fields) {
            sendMessage("qcw-login-form-iframe", {
              event_name: "extra-fields",
              extra_fields: JSON.stringify(options.extra_fields),
            });
          }
        });
      }, 1000);
    } else {
      if (qismoConfig.openAtStart && (isAttentionGrabber || !isLogin)) return;
      if (loginFormIframe && typeof loginFormIframe == "object") {
        if (qismoConfig.openAtStart && !qismoConfig.welcomeMessageStatus) {
          isOpenedIframe = true;
          isLoginFormOpened = true;
          fadeIn(loginFormIframe);
        }
        setTimeout(() => {
          if (options && options.extra_fields) {
            sendMessage("qcw-login-form-iframe", {
              event_name: "extra-fields",
              extra_fields: JSON.stringify(options.extra_fields),
            });
          }
        }, 0);
      }
    }
  };

  const renderChannelForm = () => {
    channelFormIframe = document.createElement("iframe");
    const widget = qismoConfig.channel_widget;
    let params = parseUrlParams({
      color_widget: convertHex(qismoConfig.colorWidget, 100),
      is_welcome_status: qismoConfig.welcomeMessageStatus,
      titleForm: widget ? widget.title : "Welcome",
      subtitleForm: widget
        ? widget.subtitle
        : "Send us via favourite messaging apps",
      introduction: widget
        ? widget.introduction
        : "More personalized chat with us on:",
    });
    if (options && options.whitelabel)
      whitelabelcss = `.qismo-copyright{display:none!important;}`;
    // Get template channel widget form
    let iframeSource = `${qismoConfig.qismoIframeUrl}/iframes/v5/${appId}/widget-channel${params}`;
    channelFormIframe.setAttribute("src", iframeSource);
    channelFormIframe.setAttribute("id", "qcw-channel-form-iframe");
    channelFormIframe.setAttribute("style", "display: none");
    if (document.body.clientWidth < breakpoint || isMobile) {
      changeMobileIframeSize(channelFormIframe);
    } else {
      changeIframeSize(
        channelFormIframe,
        channelFormSizes[0] + "px",
        channelFormSizes[1] + "px",
        "-12px",
        "68px",
      );
    }
    if (!document.getElementById("qcw-channel-form-iframe"))
      document.body.appendChild(channelFormIframe);
    if (qismoConfig.openAtStart && isAttentionGrabber) return;
    if (
      isFromPreviousForm ||
      qismoConfig.isChannelWidgetEnabled ||
      qismoConfig.openAtStart
    ) {
      isChannelFormOpened = true;
      isOpenedIframe = true;
      setTimeout(() => {
        fadeIn(channelFormIframe, () => {
          if (customcss)
            sendMessage("qcw-channel-form-iframe", {
              event_name: "custom-css",
              css: customcss,
            });
          if (widget)
            sendMessage("qcw-channel-form-iframe", {
              event_name: "widget",
              widget: JSON.stringify(widget),
            });
        });
      }, 1500);
    } else {
      if (customcss)
        sendMessage("qcw-channel-form-iframe", {
          event_name: "custom-css",
          css: customcss,
        });
      if (widget)
        sendMessage("qcw-channel-form-iframe", {
          event_name: "widget",
          widget: JSON.stringify(widget),
        });
    }
  };

  export const attachCustomCSS = () => {
    var css = qismoConfig.widgetCustomCSS
      ? qismoConfig.widgetCustomCSS + whitelabelcss
      : whitelabelcss;
    sendMessage("qcw-iframe", { event_name: "custom-css", css: css });
  };

  const renderQiscusWidget = (isLogin) => {
    widgetIframe = document.createElement("iframe");
    let params = parseUrlParams({
      display_name: encodeURIComponent(
        aes.encrypt(userData.display_name.toString(), appId).toString(),
      ),
      channel_id: encodeURIComponent(
        aes.encrypt(options.channel_id.toString(), appId).toString(),
      ),
      unique_id: encodeURIComponent(
        aes.encrypt(userData.unique_id.toString(), appId).toString(),
      ),
      app_id: appId,
      staging,
      color_widget: convertHex(qismoConfig.colorWidget, 100),
    });

    if (userData.extra_fields) {
      params += `&extra_fields=${encodeURIComponent(userData.extra_fields)}`;
    }
    if (options && options.extras) params += `&extras=${options.extras}`;
    if (options && options.room_badge)
      params += `&room_badge=${options.room_badge}`;
    if (options && options.merge_properties)
      params += `&merge_properties=${options.merge_properties}`;
    if (qismoConfig.isChannelWidgetEnabled)
      params += `&is_channel_widget_enable=${qismoConfig.isChannelWidgetEnabled}`;
    let iframeSource = `${qismoConfig.qismoIframeUrl}/iframes/v5/${appId}/multichannel-widget/${options.channel_id}${params}`;
    widgetIframe.setAttribute("src", iframeSource);
    widgetIframe.setAttribute("id", "qcw-iframe");
    widgetIframe.setAttribute("style", "display: none");
    if (document.body.clientWidth < breakpoint || isMobile) {
      changeMobileIframeSize(widgetIframe);
    } else {
      changeIframeSize(
        widgetIframe,
        widgetDesktopSizes[0] + "px",
        widgetDesktopSizes[1] + "px",
      );
    }
    if (options && options.whitelabel)
      whitelabelcss = `.qcw-copyright{display:none!important;}`;

    if (!document.getElementById("qcw-iframe"))
      document.body.appendChild(widgetIframe);
    if (isLoginFormOpened && !qismoConfig.openAtStart) {
      isOpenedIframe = true;
      isWidgetOpened = true;
      isLoginFormOpened = false;
      window.postMessage({ event_name: "maximize-widget" });
      fadeIn(widgetIframe);
    }
  };

  const changeIframeSize = (el, width, height, x, y) => {
    if (!el) return false;
    el.style.width = width;
    el.style.height = height;
    el.style.bottom = y ? y : "68px";
    el.style.right = x ? x : "-12px";
  };
  const changeMobileIframeSize = (el) => {
    if (!el) return false;
    changeIframeSize(el, "100%", "100%");
    el.style.bottom = 0;
    el.style.right = 0;
  };

  const setMobileView = () => {
    breakpoint = qismoConfig.mobileBreakPoint
      ? qismoConfig.mobileBreakPoint
      : options && options.mobileBreakPoint
        ? options.mobileBreakPoint
        : 500;

    // Detect strict mobile phones
    const isMobilePhone = /Mobi|Android.*Mobile|iPhone|iPod/i.test(
      navigator.userAgent,
    );
    // Detect tablets (iPad, Android tablets without 'Mobile' in UA, or modern iPads claiming MacIntel)
    // const isTablet = /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (document.body.clientWidth < breakpoint || isMobilePhone) {
      isMobile = true;
      if (welcomeMessageIframe) changeMobileIframeSize(welcomeMessageIframe);
      if (widgetIframe) changeMobileIframeSize(widgetIframe);
      if (loginFormIframe) changeMobileIframeSize(loginFormIframe);
      if (channelFormIframe) changeMobileIframeSize(channelFormIframe);
    } else {
      isMobile = false;
      if (widgetIframe)
        changeIframeSize(
          widgetIframe,
          widgetDesktopSizes[0] + "px",
          widgetDesktopSizes[1] + "px",
        );
      if (loginFormIframe)
        changeIframeSize(
          loginFormIframe,
          loginFormSizes[0] + "px",
          loginFormSizes[1] + "px",
        );
      if (channelFormIframe)
        changeIframeSize(
          channelFormIframe,
          channelFormSizes[0] + "px",
          channelFormSizes[1] + "px",
        );
    }
  };

  onMount(async () => {
    window.addEventListener("resize", function (event) {
      setMobileView();
    });

    breakpoint =
      options && options.mobileBreakPoint ? options.mobileBreakPoint : 500;
    const isMobilePhone = /Mobi|Android.*Mobile|iPhone|iPod/i.test(
      navigator.userAgent,
    );
    isMobile = window.innerWidth < breakpoint || isMobilePhone;

    loadQismo();

    return () => {
      if (widgetIframe && typeof widgetIframe == "object") {
        document.body.removeChild(widgetIframe);
        widgetIframe = null;
      }
      if (loginFormIframe && typeof loginFormIframe == "object") {
        document.body.removeChild(loginFormIframe);
        loginFormIframe = null;
      }
      if (channelFormIframe && typeof channelFormIframe == "object") {
        document.body.removeChild(channelFormIframe);
        channelFormIframe = null;
      }
      if (welcomeMessageIframe && typeof welcomeMessageIframe == "object") {
        document.body.removeChild(welcomeMessageIframe);
        welcomeMessageIframe = null;
      }
    };
  });

  export let appId;
  export let options;
</script>

<main>
  {#if isInitiated}
    {#if !showBtnWelcome}
      {#if (!isLoginFormOpened && !isChannelFormOpened && !isWidgetOpened && isMobile) || !isMobile}
        <QiscusTriggerBtn
          on:click={toggleWidget}
          {isMobile}
          label={window.qismoConfig.buttonText}
          buttonHasIcon={window.qismoConfig.buttonHasIcon}
          buttonHasText={!isOpenedIframe
            ? window.qismoConfig.buttonHasText
            : false}
          icon={!isOpenedIframe
            ? window.qismoConfig.buttonIcon
            : window.qismoConfig.buttonCloseIcon}
          backgroundColor={window.qismoConfig.colorWidget}
          isButtonClose={isOpenedIframe}
        />
      {/if}
    {/if}
  {/if}
  {#if showBtnWelcome}
    <QiscusTriggerBtn
      on:click={toggleWelcomeMessage}
      {isMobile}
      label={window.qismoConfig.buttonText}
      buttonHasIcon={window.qismoConfig.buttonHasIcon}
      buttonHasText={!isOpenedIframe ? window.qismoConfig.buttonHasText : false}
      icon={!isOpenedIframe
        ? window.qismoConfig.buttonIcon
        : window.qismoConfig.buttonCloseIcon}
      backgroundColor={window.qismoConfig.colorWidget}
      isButtonClose={isOpenedIframe}
    />
  {/if}
</main>

<style>
  :global(
      iframe#qcw-iframe,
      iframe#qcw-welcome-iframe,
      iframe#qcw-attention-grabber-iframe,
      iframe#qcw-login-form-iframe,
      iframe#qcw-channel-form-iframe
    ) {
    border: 0;
    margin: 0;
    padding: 0;
    position: fixed;
    z-index: 999999;
  }
  :global(iframe#qcw-welcome-iframe, iframe#qcw-channel-form-iframe) {
    right: 0;
    box-shadow: none;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
