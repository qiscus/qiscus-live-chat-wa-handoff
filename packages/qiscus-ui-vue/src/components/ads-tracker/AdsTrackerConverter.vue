<template lang="pug">
  .qcw-ads-tracker
    .content(v-if="!controlUi.showPopUp")
      header
        h1(:style="{color: '#27b199' }") Qiscus Ads Tracker
        p(v-if="currentFormStep === 0" class="subtitle") Collecting your user data and insights regarding the performance of your online click to WhatsApp advertising campaigns. Select the appropriate ad below.
      .wrapper-step
        .stepper-form(:style="`transform: translateX(${positionStyle})`")
          .track
            ul(v-if="!loading.listOfAds" class="ads-item-wrapper")
              li(v-for="(ads, i) in listOfAds" :key="ads.Conversion && ads.Conversion.id ? ads.Conversion.id : i" class="ads-item" @click="selectedAds(ads)")
                span(class="circle" :class="{ selected: !!form.selectedAds && form.selectedAds.Conversion.id === ads.Conversion.id}" @click="selectedAds(ads)")
                .card-ads
                  img(v-if="ads.img_src" :src="ads.img_src")
                  icon(v-else name="ic-image-attachment" fill="#DFDFDF")
                  div
                    p {{ ads.Ad && ads.Ad.name }}
                    p(class="item-sub") {{ ads.Conversion && timestamp(ads.Conversion.created_at) }}
              li(v-if="!loading.failedListOfAds && listOfAds.length === 0" class="ads-item" style="justify-content: center") No data.
              li(v-if="loading.failedListOfAds" class="ads-item" style="justify-content: center; flex-direction: column")
                p(style="font-size: 14px") Failed to get data
                button(
                  class="primary"
                  @click="getListAdsAvailable()") Reload
            div(v-else class="loader-container")
              loader(width="40px" height="40px")
              p(v-if="showWaitingMessage" class="waiting-message") Please wait, this process may take up to 30 seconds.

          .track
            form(v-if="validateForm(1)" style="padding: 0px 24px")
              label(class="form-label") Ads Name
              .card-ads
                img(v-if="form.selectedAds.img_src" :src="form.selectedAds.img_src")
                icon(v-else name="ic-image-attachment" fill="#DFDFDF")
                p(style="color: #565656") {{ form.selectedAds.Ad && form.selectedAds.Ad.name }}
              label(class="form-label") Users
              input(type="text" readonly :value="(form.user && form.user.username) || ''")
              label(class="form-label") Phone Number
              input(type="text" readonly :value="form.phoneNumber || ''")
              div
                label(class="form-label") Events
                select-input(:options="filteredFbEvent" placeholder="Select Events" @change="form.selectedEvent = $event" @search="search")
              div(v-if="form.selectedEvent && form.selectedEvent.name === 'Purchase'")
                label(class="form-label") Purchase Value
                div(class="price-form" style="margin-bottom: 200px")
                  input(type="text" readonly :value="form.currency" style="width: 70px; text-align: center")
                  input(type="number" class="number-input" v-model="form.price" min="0" @input="handleMinus")
      .footer
        button(
          class="secondary"
          @click="prevForm()" ) {{ currentFormStep === 0 ? 'Cancel' : 'Back' }}
        button(
          class="primary flex-center"
          :disabled="disabledNext"
          @click="nextForm()")
            loader(v-if="loading.submitting" width="15px" height="15px"  borderWidth="2px" style="margin-top: 0px; position: unset")
            span {{ currentFormStep === 1 ? 'Convert Ads' : 'Next' }}

    .popup(v-else)
      img(:src="controlUi.success ? controlUi.succ_imgsrc : controlUi.err_imgsrc" style="width: 40px; height: 40px; margin-top: 10px")
      h1(style="font-size: 24px") {{ controlUi.success ? controlUi.succ_head : controlUi.err_head }}
      p(style="color: #565656; margin: 16px 0px") {{ controlUi.success ? controlUi.succ_subtitle : controlUi.err_subtitle }}
      button(
        class="primary"
        :style="{ background: controlUi.success ? '#27B199' : '#EB5757', borderColor: controlUi.success ? '#27B199' : '#EB5757' }"
        @click="closePopup()"
      ) Ok


    .backdrop(@click="closePopup()")


</template>
<script>
import Icon from '../Icon';
import SelectInput from './SelectInput';
import Loader from '../Loader';

export default {
  name: 'AdsTrackerConverter',
  components: {
    Icon,
    SelectInput,
    Loader,
  },
  props: ['core'],
  computed: {
    positionStyle() {
      if (this.currentFormStep > 0) {
        return `-${this.currentFormStep * 100}%`;
      }
      return '0px';
    },
    disabledNext() {
      return !this.validateForm(this.currentFormStep + 1) || this.loading.submitting;
    },
    filteredFbEvent() {
      if (this.fbEventSearchKeyword && this.fbEventSearchKeyword.trim()) {
        const keyword = this.fbEventSearchKeyword.trim().toLowerCase();
        return this.fbEvents.filter(t => t.label.toLowerCase().includes(keyword));
      }
      return this.fbEvents;
    },
  },
  data() {
    return {
      currentFormStep: 0,
      form: {
        selectedAds: null,
        user: null,
        phoneNumber: null,
        selectedEvent: null,
        roomId: null,
        agent: null,
        price: 0,
        currency: null,
      },
      loading: {
        listOfAds: false,
        failedListOfAds: false,
        submitting: false,
      },
      listOfAds: [],
      fbEvents: [],
      fbEventSearchKeyword: '',
      controlUi: {
        showPopUp: false,
        success: true,
        succ_imgsrc: '/img/icon_success.svg',
        succ_head: 'Success',
        succ_subtitle: 'Successfuly converting Ads',
        err_imgsrc: '/img/icon_warning.svg',
        err_head: 'Failed Converting Ads',
        err_subtitle: '',
      },
      retryTimer: null,
      initialDelayTimer: null,
      waitingMessageTimer: null,
      showWaitingMessage: false,
    };
  },
  methods: {
    closePopup() {
      this.controlUi.showPopUp = false;
      this.controlUi.success = true;
      this.controlUi.err_subtitle = '';
      this.$emit('handle-close');
    },
    nextForm() {
      const nextFormStep = this.currentFormStep + 1;
      if (this.validateForm(nextFormStep)) {
        if (nextFormStep > 1) {
          // submit
          this.submitForm();
        } else {
          this.currentFormStep = nextFormStep;
        }
      }
    },
    prevForm() {
      if (this.currentFormStep > 0) {
        this.currentFormStep -= 1;
      } else {
        this.closePopup();
      }
    },
    validateForm(formStep) {
      switch (formStep) {
        case 1:
          return !!this.form.selectedAds;
        case 2: {
          const regularValidation = !!this.form.selectedAds
            && !!this.form.user
            && !!this.form.phoneNumber
            && !!this.form.selectedEvent
            && !!this.form.agent;
          const isPriceAllowed = !(this.form.price === '' || this.form.price === null);
          return this.form.selectedEvent && this.form.selectedEvent.name === 'Purchase'
            ? (regularValidation && isPriceAllowed)
            : regularValidation;
        }
        default:
          return false;
      }
    },
    setFormValue() {
      if (this.core) {
        const user = this.core.selected.participants.filter(u => u.extras === null || u.extras.type === undefined || u.extras.type !== 'agent');
        if (user.length) {
          this.form.user = user[0];
          // email identifier for WA channel user using number
          this.form.phoneNumber = this.form.user.email;
        }
        this.form.roomId = this.core.selected.id;
        this.form.agent = this.core.userData;
      }
    },
    search(keyword) {
      this.fbEventSearchKeyword = keyword;
    },
    getListAdsAvailable() {
      if (this.initialDelayTimer) {
        clearTimeout(this.initialDelayTimer);
        this.initialDelayTimer = null;
      }

      this.loading.listOfAds = true;
      this.loading.failedListOfAds = false;

      if (!this.showWaitingMessage) {
        if (this.waitingMessageTimer) {
          clearTimeout(this.waitingMessageTimer);
          this.waitingMessageTimer = null;
        }

        this.waitingMessageTimer = setTimeout(() => {
          if (this.loading.listOfAds) {
            this.showWaitingMessage = true;
          }
        }, 5000);
      }

      window.adsTracker.getListAds(this.form.roomId)
        .then((res) => {
          const mappedAds = res.map((ad) => {
            const img = ad.Conversion.image_url || 'https://omnichannel.qiscus.com/img/broken-image.jpg';
            return {
              ...ad,
              img_src: img,
            };
          });

          if (mappedAds.length > 0) {
            this.listOfAds = mappedAds;
            this.loading.listOfAds = false;
            this.showWaitingMessage = false;
            if (this.waitingMessageTimer) {
              clearTimeout(this.waitingMessageTimer);
              this.waitingMessageTimer = null;
            }
            if (this.retryTimer) {
              clearInterval(this.retryTimer);
              this.retryTimer = null;
            }
            if (this.initialDelayTimer) {
              clearTimeout(this.initialDelayTimer);
              this.initialDelayTimer = null;
            }
          } else if (!this.initialDelayTimer && !this.retryTimer) {
            this.initialDelayTimer = setTimeout(() => {
              this.initialDelayTimer = null;
              this.retryTimer = setInterval(() => {
                this.getListAdsAvailable();
              }, 5000);
            }, 20000);
          }
        })
        .catch((err) => {
          this.loading.failedListOfAds = true;
          this.loading.listOfAds = false;
          this.showWaitingMessage = false;
          if (this.waitingMessageTimer) {
            clearTimeout(this.waitingMessageTimer);
            this.waitingMessageTimer = null;
          }
          if (this.retryTimer) {
            clearInterval(this.retryTimer);
            this.retryTimer = null;
          }
          if (this.initialDelayTimer) {
            clearTimeout(this.initialDelayTimer);
            this.initialDelayTimer = null;
          }
          console.log(err);
        });
    },
    getListEvents() {
      window.adsTracker.getlistEvent()
        .then((res) => {
          this.fbEvents = res.map(e => ({ ...e, id: e.name, label: e.name }));
        })
        .catch(err => console.log(err));
    },
    submitForm() {
      this.loading.submitting = true;
      const payload = {
        eventName: this.form.selectedEvent.name,
        agentName: this.form.agent.username,
        conversionId: this.form.selectedAds.Conversion.id,
      };

      if (this.form.selectedEvent.name === 'Purchase') {
        payload.price = this.form.price;
        payload.currency = this.form.currency;
      }

      window.adsTracker.convert(payload)
        .then(() => {
          this.controlUi.showPopUp = true;
          this.controlUi.success = true;
        })
        .catch((err) => {
          this.controlUi.showPopUp = true;
          this.controlUi.success = false;
          this.controlUi.err_subtitle = err.message;
        })
        .finally(() => {
          this.loading.submitting = false;
        });
    },
    timestamp(dateString) {
      const date = new Date(dateString);
      const config = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
      return new Intl.DateTimeFormat('en-US', config).format(date);
    },
    selectedAds(ads) {
      this.form.selectedAds = ads;
      if (ads && ads.Ad.insights && ads.Ad.insights[0]) {
        this.form.currency = ads.Ad.insights[0].account_currency || 'IDR';
      } else {
        // fallback idr
        this.form.currency = 'IDR';
      }
    },
    handleMinus() {
      if (this.form.price < 0) {
        this.form.price = 0;
      }
    },
  },
  mounted() {
    this.setFormValue();
    this.getListAdsAvailable();
    this.getListEvents();
  },
  beforeDestroy() {
    if (this.initialDelayTimer) {
      clearTimeout(this.initialDelayTimer);
    }
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }
    if (this.waitingMessageTimer) {
      clearTimeout(this.waitingMessageTimer);
    }
  },
};
</script>
<style lang="stylus" scoped>
.ads-item-wrapper
  margin: 0px;
  padding: 20px;
  .ads-item
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px;
    border-bottom: 1px solid #ECECEC;
    &:last-child
      border-bottom: none;
      margin-bottom: 50px;
    span.circle
      width: 18px;
      height: 18px;
      border-radius: 100%;
      background: #27B199;
      cursor pointer;
      position: relative;
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      &.selected::after {
        width: 10px !important;
        height: 10px !important;
      }
      &::after
        content: '';
        position: absolute;
        background: white;
        border-radius: 100%;
        width: 16px;
        height: 16px;
    .item-sub
      font-size: 12px;
      color: #a0a0a0;
.loader-container
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  .waiting-message
    position: absolute;
    top: 7rem;
    font-size: 14px;
    color: #565656;
    text-align: center;
.card-ads
  display: flex;
  gap: 20px;
  align-items: center;
  cursor: pointer;
  img,svg
    margin: 0px;
    width: 50px;
    height: 50px;
    border-radius: 8px;
    object-fit: cover;
  img
    background: #ECECEC;
  p
    margin: 0px;
    font-size: 14px;
    font-weight: 500;

.form-label
  color: #0A0A0A;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  margin: 20px 0px 10px;
  display: block;

input[type=text], .number-input
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  padding: 14px 16px;
  border: 1px solid #A0A0A0;
  border-radius: 6px;
  width: 100%;
  &:focus
    outline-color: #A0A0A0;
  &:read-only
    border: none;
    background: #ECECEC;
    color: #A0A0A0;

.qcw-ads-tracker
  position fixed
  top 0
  left 0
  right 0
  bottom 0
  display flex
  align-items center
  justify-content center
  z-index 3

  h1
    margin-block-start: 0.67em;
    margin-block-end: 0.67em;
    margin-inline-start: 0px;
    margin-inline-end: 0px;

  .backdrop
    position absolute
    top 0
    left 0
    right 0
    bottom 0
    background-color #404040
    opacity 0.5

  .popup
    z-index 3
    width 100%
    max-width 420px
    min-height 290px
    background-color #fff
    border-radius 8px
    margin 0 16px
    display: flex;
    align-items: center;
    justify-content: center;
    flex-flow: column;
    position: relative;
    animation fadeInUp 0.2s ease-out;
    padding: 32px 20px;

  .content
    z-index 3
    width 100%
    max-width 620px
    height 85%
    background-color #fff
    border-radius 8px
    margin 0 16px
    display: flex;
    flex-flow: column;
    position: relative;
    animation fadeInUp 0.2s ease-out;

    header
      padding: 20px 24px;
      h1
        text-align: center;
        font-size: 20px;
        font-weight: bold;
      .subtitle
        text-align: center;
        font-size: 12px;
        color: #565656;
        letter-spacing: 0.06px;
    .wrapper-step
      height: calc(100% - 190px);
      overflow: hidden;
      .stepper-form
        height: 100%;
        display: flex;
        transition: transform .2s ease-in-out;

        .track
          height: 100%;
          width 100%;
          overflow: auto;
          flex-shrink: 0;
          &::-webkit-scrollbar-track
            border-radius: 10px;
            background-color: #fafafa;

          &::-webkit-scrollbar
            width: 8px;
            background-color: #fafafa;

          &::-webkit-scrollbar-thumb
            border-radius: 4px;
            background-color: #e0e0e0;

          .price-form
            display: flex;
            gap: 1rem;
    .footer
        position: absolute;
        bottom: 0;
        height: 100px;
        width: 100%;
        border-radius: 0px 0px 6px 6px;
        background: #FFF;
        box-shadow: 0px -4px 8px 0px rgba(0, 0, 0, 0.08);
        display: flex;
        gap: 20px;
        align-items: center;
        justify-content: center;

  button
    display: flex;
    padding: 8px 32px;
    justify-content: center;
    align-items: center;
    gap: 10px;
    border-radius: 9999px;
    cursor: pointer;
    &:disabled
      cursor: not-allowed;
      color: #A0A0A0 !important;
      border-color: #ECECEC !important;
      &.primary
        background: #ECECEC !important;
    &:hover
      opacity 0.8;
    &.primary
      color: white;
      border: 1px solid;
      border-color: #27B199;
      background: #27B199;
    &.secondary
      border: 1px solid;
      background: white;
      border-color: #27B199;
      color: #27B199;
    &.flex-center
      display: flex;
      justify-content: center;
      align-items: center;
</style>
