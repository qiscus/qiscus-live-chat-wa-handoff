<template lang="pug">
  .qcw-menu-wrapper
    .qcw-menu-trigger
      //- i.qcw-icon(style='padding: 0px; padding-left: 8px')
      span.qcw-icon
        label(style="height: 20px" @click='toggleMenu')
          icon(name='ic-assistant' :style="isActive ? 'color: #27B199;' : 'color: #A0A0A0;'")
    .qcw-menu-popup(v-if='isMenuOpen')
      ul.qcw-menu(:class="{ 'is-hidden': isLangMenuOpen }")
        li(v-for='menuItem in menuItems' @click.stop='selectMenuItem(menuItem)' :key='menuItem.id')
          template(v-if="menuItem.id=='separator'")
            span.qcw-menu-separator
              | Generate Ideas
              span.qcw-menu-separator-filler
          template(v-else)
            icon(:name="'ic-'.concat(menuItem.id)" style="height: 20px")
            span {{ menuItem.label }}
            icon(v-if="menuItem.id=='translation-text'" name="ic-arrow-right" style="margin-left: auto; margin-top: 2px; height: 20px")

      .qcw-menu-langs(:class="{ 'is-visible': isLangMenuOpen }")
        .qcw-menu-navigation(@click.stop="isLangMenuOpen = false")
          icon(name="ic-back" style="margin-top: -2px; height: 20px" @click="isLangMenuOpen = false")
          p(@click="(event) => event.stopPropagation()" style="margin: 0px") Chat Translation
        .qcw-filter
          .qcw-search-icon(@click="(event) => event.stopPropagation()")
            icon(name="ic-search" style="height: 20px; margin-top: -8px")
          input.qcw-search-input(
            type="text"
            placeholder="Search languages"
            v-model="searchLang"
            @click="(event) => event.stopPropagation()"
          )
        ul.qcw-item-langs
          li(v-for='lang in filteredLangs' :key='lang.code' @click.stop='translateText(lang)')
            template
              span(style="font-weight: 500; color: #0A0A0A" ) {{ lang.name }}
</template>

<script>
import Icon from './../Icon';

export default {
  name: 'AssistantMenu',
  components: {
    Icon,
  },
  props: {
    core: {
      type: Object,
      required: true,
    },
    menu: {
      type: [Object, null],
      required: false,
    },
    assistantResult: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      isMenuOpen: false,
      isLangMenuOpen: false,
      searchLang: '',
      menuItems: [
        { id: 'improve-text', label: 'Improve Text' },
        { id: 'lengthen-text', label: 'Lengthen Text' },
        { id: 'shorten-text', label: 'Shorten Text' },
        { id: 'translation-text', label: 'Chat Translation'  },
        { id: 'separator' },
        { id: 'ai-generate', label: 'AI Generate' },
        { id: 'knowledge-base', label: 'Knowledge Base Generate' },
        { id: 'copilot-assistance', label: 'Copilot Assistance' },
      ],
      isActive: false,
    };
  },
  mounted() {
    document.addEventListener('click', () => {
      if (this.isMenuOpen) {
        this.isMenuOpen = false;
        this.isActive = false;
      }
    });
    this.getLanguages();
  },
  watch: {
    assistantResult: {
      handler(val) {
        this.isActive = Boolean(val && val.length);
      },
    },
  },
  computed: {
    filteredLangs() {
      if (this.searchLang === '' || this.searchLang === null) {
        return this.langs;
      }
      const keyword = this.searchLang.toLowerCase();
      return this.langs.filter(item => item.name.toLowerCase().includes(keyword));
    },
  },
  methods: {
    toggleMenu(event) {
      event.stopPropagation();
      if (this.menu === null) {
        this.isMenuOpen = !this.isMenuOpen;
        this.isLangMenuOpen = false;
        this.isActive = true;
      }
    },
    selectMenuItem(menuItem) {
      if (menuItem.id !== 'separator') {
        if (menuItem.id === 'translation-text') {
          this.$nextTick(() => {
            this.isLangMenuOpen = true;
          });
        } else if (menuItem.id === 'copilot-assistance') {
          this.openCopilotWidget();
        } else if (menuItem.id === 'knowledge-base') {
          this.openCopilotWidget('knowledge-base');
        } else if (menuItem.id === 'ai-generate') {
          this.openCopilotWidget('ai-generate');
        } else {
          this.$nextTick(() => {
            this.isMenuOpen = false;
            this.$emit('assistant-menu', menuItem);
          });
        }
      }
    },
    openCopilotWidget(action = null) {
      const vue = window.vue;
      if (vue && vue.listUnfilteredAddOn) {
        const acwAddon = vue.listUnfilteredAddOn.find(
          addon => addon.iframe_url && addon.iframe_url.includes('/acw/'),
        );
        if (acwAddon) {
          const actionPayload = { action };
          if (action) {
            const room = window.qiscus && window.qiscus.selected;
            if (room) {
              const comments = (room.comments || []).filter(c => c.type === 'text').map(c => ({
                role: (c.user_extras && c.user_extras.type === 'customer') ? 'user' : 'assistant',
                content: c.message,
              }));

              const options = room.options ? JSON.parse(room.options) : {};
              if (action === 'ai-generate') {
                actionPayload.chat_history = comments.slice(-6);
              } else if (action === 'knowledge-base') {
                const history = comments.slice(-10);
                actionPayload.chat_history = history.slice(0, -1);
                actionPayload.last_question = history.length > 0 ? history[history.length - 1].content : '';
                actionPayload.channel_id = options.channel_id || null;
              }
            }
          }

          window.pendingCopilotAction = actionPayload;
          window.selectAddOn(acwAddon);
          this.isMenuOpen = false;

          if (action) {
            const iframe = document.getElementById('ACW__widget-iframe');
            if (iframe && iframe.contentWindow) {
              const origin = new URL(acwAddon.iframe_url).origin;
              iframe.contentWindow.postMessage({
                event: 'copilot-assistance-action',
                data: actionPayload,
              }, origin);
              window.pendingCopilotAction = null;
            }
          }
        }
      }
    },
    translateText(value) {
      const lang = { ...value };
      lang.id = 'translation-text';
      lang.label = 'Chat Translation';
      this.$nextTick(() => {
        this.isMenuOpen = false;
        this.isLangMenuOpen = false;
        this.$emit('assistant-menu', lang);
      });
    },
    getLanguages() {
      window.aiAssistant.getLanguages().then((res) => {
        this.langs = res;
        this.$emit('assistant-language', res);
      });
    },
  },
};
</script>
<style scoped>
.qcw-menu-wrapper {
  position: relative;
  display: flex;
  align-items: flex-end;
}

.qc-icon {
  cursor: pointer;
  margin: 0px;
}

.qcw-menu-popup {
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 1;
  background-color: #FFFFFF;
  box-shadow: 0px 4px 12px 0px #0A0A0A1A;
  border-radius: 6px;
  padding: 8px 0;
  overflow: hidden;
}

.qcw-menu,
.qcw-menu-langs {
  list-style-type: none;
  padding: 0;
  margin: 0;
  width: 261px;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.qcw-menu {
  opacity: 1;
  transform: translateX(0);
}

.qcw-menu.is-hidden {
  opacity: 0;
  transform: translateX(-100%);
}

.qcw-menu-langs {
  opacity: 0;
  transform: translateX(100%);
  position: absolute;
  top: 0;
  left: 0;
}

.qcw-menu-langs.is-visible {
  opacity: 1;
  transform: translateX(0);
}

.qcw-menu li {
  padding: 8px 16px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}

.qcw-menu li:hover {
  background-color: #f5f5f5;
}

.qcw-item-langs  {
  padding: 0;
  /* cursor: pointer; */
  max-height: 160px;
  overflow-y: auto;
  margin-top: 6px;

}
.qcw-item-langs li {
  padding: 6px 24px 6px 24px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}

.qcw-item-langs li:hover {
  background-color: #f5f5f5;
}


.qcw-item-langs::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.qcw-item-langs::-webkit-scrollbar-track {
  background: transparent;
}

.qcw-item-langs::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 4px;
  width: 8px;
  height: 8px;
}

.qcw-item-langs::-webkit-scrollbar-thumb:hover {
  background: #ddd;
}

.qcw-menu-separator{
  font-size: 9px;
  font-weight: 400;
  line-height: 14px;
  letter-spacing: 0.005em;
  text-align: left;
  color: rgba(160, 160, 160, 1);
  width: 100%;
  align-items: center;
  gap: 4px;
  display: flex;
}
.qcw-menu-separator-filler{
  width: 100%;
  height: 1px;
  border-radius: 5px;
  background: rgba(160, 160, 160, 1);
  display: flex;
}

.qcw-menu-navigation {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding-left: 18px;
  margin-top: 16px;
  margin-bottom: 16px;

  p {
    color: #27B199;
  }
}

.qcw-filter {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 238px;
  margin: 0 12px;
}

.qcw-search-icon {
  position: absolute;
  left: 10px;
  top: 60%;
  transform: translateY(-50%);
  color: #888;
}

.qcw-search-input {
  width: 100%;
  padding: 10px 10px 10px 40px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-shadow: 0px 2px 8px 0px #0A0A0A1A;

  &:focus {
    border-color: #007bff;
  }

  &::placeholder {
    color: #A0A0A0;
    font-size: 14px;
  }
}
</style>
