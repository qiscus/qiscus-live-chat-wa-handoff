<template lang="pug">
.assistant-result-wrapper(v-if='menu != null' @click.stop="isLangMenuOpen = false")
  .assistant-result-header(v-if='assistantResult')
    .assistant-result-header-left
      icon(:name='`ic-${menu.id}`')
      p(style="font-weight: 600; color: #0A0A0A") Qiscus Agent Copilot {{ generatedLabel }}
    .assistant-result-header-right(@click='closeMenu')
      icon(:name='`ic-assistant-close`')
  .assistant-result-loader(v-if='!assistantResult || regenerate')
    img(src='https://dnlbo7fgjcc7f.cloudfront.net/fulda-5g5sizvzw3ch9mj/image/upload/BfN50FQ9PI/795f86ade3ee9d068516d41c7a8046ae.gif' alt='Assistant Loader')
    span Qiscus Agent Copilot {{ generatedLoaderLabel }}
  .assistant-result-content(v-if='assistantResult && !regenerate')
    | {{ assistantResult }}
  .assistant-result-actions(v-if='assistantResult && !regenerate' style="position: relative")
    .assistant-result-actions-left
      .menu-icon(@click="regenerateWithOptions('lengthen')")
        icon(name="lengthen")
        .menu-icon-name Lengthen Text
      .menu-icon(@click="regenerateWithOptions('shorten')")
        icon(name="shorten")
        .menu-icon-name Shorten Text
      .menu-icon(style="margin-left: 4px; margin-top: 8px; position: relative" @click.stop="isLangMenuOpen = !isLangMenuOpen")
        icon(name="translation")
        .menu-icon-name Chat Translate

    .qcw-menu-popup(v-if="isLangMenuOpen")
      .qcw-menu-langs(:class="{ 'is-visible': isLangMenuOpen }")
        .qcw-filter
          .qcw-search-icon(@click="(event) => event.stopPropagation()")
            icon(name="ic-search")
          input.qcw-search-input(
            type="text"
            placeholder="Search languages"
            v-model="searchLang"
            @click="(event) => event.stopPropagation()"
          )
        ul.qcw-item-langs
          li(v-for='lang in filteredLangs' :key='lang.code' @click.stop="regenerateWithOptions('translation', selectedLang = lang.code)")
            template
              span(style="font-weight: 500; color: #0A0A0A" ) {{ lang.name }}


    .assistant-result-actions-right
      .apply-text(@click="$emit('assistant-apply', true)")
        | Apply Text
</template>
<script>
import Icon from '../Icon';

export default {
  name: 'AssistantResult',
  props: {
    core: {
      type: Object,
      required: true,
    },
    menu: {
      type: [Object, null],
      required: false,
    },
    chatHistory: {
      type: [Array, null],
      required: false,
    },
    channelId: {
      type: [Number, null],
      required: false,
    },
    assistantResult: {
      type: String,
      required: true,
    },
    agentInput: {
      type: String,
      required: true,
    },
    langs: {
      type: [Array, null],
      required: false,
    },
  },
  data() {
    return {
      regenerate: false,
      dropdown: {
        opened: false,
        selected: 'Shorten Text',
      },
      isLangMenuOpen: false,
      searchLang: '',
      menuItem: {},
      selectedLang: '',
    };
  },
  components: {
    Icon,
  },
  computed: {
    generatedLabel() {
      let label = '';
      if (this.menuItem !== null) {
        switch (this.menuItem.id) {
          case 'improve-text':
          case 'shorten-text':
          case 'lengthen-text':
            label = 'Improved Text Results';
            break;

          case 'ai-generate':
          case 'knowledge-base':
            label = 'Generate Ideas Result';
            break;

          case 'translation-text':
            label = 'Chat Translation Results';
            break;

          default:
            break;
        }
      }
      return label;
    },
    generatedLoaderLabel() {
      let label = '';
      if (this.menuItem !== null) {
        switch (this.menuItem.id) {
          case 'improve-text':
          case 'shorten-text':
          case 'lengthen-text':
            label = 'is improving your text...';
            break;

          case 'ai-generate':
          case 'translation-text':
            label = 'generating your ideas...';
            break;

          case 'knowledge-base':
            label = 'is generating your ideas by knowledge base...';
            break;

          default:
            break;
        }
      }
      return label;
    },
    lastComment() {
      return this.chatHistory !== null ? this.chatHistory[this.chatHistory.length - 1] : null;
    },
    last10Comments() {
      return this.chatHistory !== null ? this.chatHistory.slice(-10) : null;
    },
    last6Comments() {
      return this.chatHistory !== null ? this.chatHistory.slice(-6) : null;
    },
    filteredLangs() {
      if (this.searchLang === '' || this.searchLang === null) {
        return this.langs;
      }
      const keyword = this.searchLang.toLowerCase();
      return this.langs.filter(item => item.name.toLowerCase().includes(keyword));
    },
  },
  methods: {
    closeMenu() {
      this.$emit('assistant-changes', {
        history: null,
        input: '',
        menu: null,
        channel_id: null,
      });
      this.$emit('assistant-result', '');
      this.isLangMenuOpen = false;
    },
    setDropdown(value) {
      this.dropdown.selected = value;
    },
    regenerateWithOptions(value) {
      if (value === 'lengthen') {
        this.regenerate = true;
        this.menuItem = { id: 'lengthen-text', label: 'Lengthen Text' };
        window.aiAssistant.paraphraseLonger(this.assistantResult).then((res) => {
          this.regenerate = false;
          if (res.content) {
            this.$emit('assistant-result', res.content);
          }
        });
      } else if (value === 'shorten') {
        this.regenerate = true;
        this.menuItem = { id: 'shorten-text', label: 'Shorten Text' };
        window.aiAssistant.paraphraseShorter(this.assistantResult).then((res) => {
          this.regenerate = false;
          this.generatedLabel = 'shorten-text';
          if (res.content) {
            this.$emit('assistant-result', res.content);
          }
        });
      } else if (value === 'translation') {
        this.regenerate = true;
        this.menuItem = { id: 'translation-text', label: 'Chat Translation' };
        const payload = {
          lang: this.selectedLang,
          text: this.agentInput,
        };
        window.aiAssistant.translationText(payload).then((res) => {
          this.regenerate = false;
          if (res.content) {
            this.$emit('assistant-result', res.content);
            this.isLangMenuOpen = false;
          }
        });
      }
    },
    sendErrorAiAssistant(title, message) {
      const targetWindow = window.parent;
      targetWindow.postMessage({
        name: 'error',
        title,
        message,
      }, window.location.origin);
    },
  },
  watch: {
    menu: {
      deep: true,
      handler(newValue) {
        this.$emit('assistant-result', '');
        const eM = {
          noData: {
            title: 'Failed to Improve',
            message: 'Please enter the sentence that needs to be improved.',
          },
          improve: {
            title: 'Failed to Improve',
            default: 'Encountered an error when improving your text. Please contact your administrator.',
          },
          generate: {
            title: 'Failed to Generate',
            default: 'Encountered an error when generate idea. Please contact your administrator.',
          },
        };
        if (newValue !== null) {
          this.menuItem = newValue;
          const history = this.last10Comments.slice(0, -1);
          const question = this.lastComment.content;
          this.setDropdown('Shorten Text');
          switch (newValue.id) {
            case 'improve-text':
              if (this.agentInput !== '') {
                window.aiAssistant.paraphrase(this.agentInput).then((res) => {
                  if (res.content) {
                    this.$emit('assistant-result', res.content);
                  } else if (res.error !== undefined) {
                    this.sendErrorAiAssistant(eM.improve.title, res.error.message);
                    this.closeMenu();
                  } else {
                    this.sendErrorAiAssistant(eM.improve.title, eM.improve.default);
                    this.closeMenu();
                  }
                }).catch(() => {
                  this.sendErrorAiAssistant(eM.improve.title, eM.improve.default);
                  this.closeMenu();
                });
              } else {
                this.sendErrorAiAssistant(eM.noData.title, eM.noData.message);
                this.closeMenu();
              }
              break;
            case 'lengthen-text':
              this.setDropdown('Lengthen Text');
              if (this.agentInput !== '') {
                window.aiAssistant.paraphraseLonger(this.agentInput).then((res) => {
                  if (res.content) {
                    this.$emit('assistant-result', res.content);
                  } else if (res.error !== undefined) {
                    this.sendErrorAiAssistant(eM.improve.title, res.error.message);
                    this.closeMenu();
                  } else {
                    this.sendErrorAiAssistant(eM.improve.title, eM.improve.default);
                    this.closeMenu();
                  }
                }).catch(() => {
                  this.sendErrorAiAssistant(eM.improve.title, eM.improve.default);
                  this.closeMenu();
                });
              } else {
                this.sendErrorAiAssistant(eM.noData.title, eM.noData.message);
                this.closeMenu();
              }
              break;
            case 'shorten-text':
              if (this.agentInput !== '') {
                window.aiAssistant.paraphraseShorter(this.agentInput).then((res) => {
                  if (res.content) {
                    this.$emit('assistant-result', res.content);
                  } else if (res.error !== undefined) {
                    this.sendErrorAiAssistant(eM.improve.title, res.error.message);
                    this.closeMenu();
                  } else {
                    this.sendErrorAiAssistant(eM.improve.title, eM.improve.default);
                    this.closeMenu();
                  }
                }).catch(() => {
                  this.sendErrorAiAssistant(eM.improve.title, eM.improve.default);
                  this.closeMenu();
                });
              } else {
                this.sendErrorAiAssistant(eM.noData.title, eM.noData.message);
                this.closeMenu();
              }
              break;
            case 'translation-text':
              if (this.agentInput !== '') {
                const payload = {
                  lang: this.menuItem.code,
                  text: this.agentInput,
                };
                window.aiAssistant.translationText(payload).then((res) => {
                  if (res.content) {
                    this.$emit('assistant-result', res.content);
                  } else if (res.error !== undefined) {
                    this.sendErrorAiAssistant(eM.improve.title, res.error.message);
                    this.closeMenu();
                  } else {
                    this.sendErrorAiAssistant(eM.improve.title, eM.improve.default);
                    this.closeMenu();
                  }
                }).catch(() => {
                  this.sendErrorAiAssistant(eM.improve.title, eM.improve.default);
                  this.closeMenu();
                });
              } else {
                this.sendErrorAiAssistant(eM.noData.title, eM.noData.message);
                this.closeMenu();
              }
              break;
            case 'ai-generate':
              window.aiAssistant.completions(this.last6Comments).then((res) => {
                if (res.content) {
                  this.$emit('assistant-result', res.content);
                } else if (res.error !== undefined) {
                  this.sendErrorAiAssistant(eM.generate.title, res.error.message);
                  this.closeMenu();
                } else {
                  this.sendErrorAiAssistant(eM.generate.title, eM.generate.default);
                  this.closeMenu();
                }
              }).catch(() => {
                this.sendErrorAiAssistant(eM.generate.title, eM.generate.default);
                this.closeMenu();
              });
              break;

            case 'knowledge-base':
              window.aiAssistant.pekaBgt(question, history, this.channelId).then((res) => {
                if (res.answer) {
                  this.$emit('assistant-result', res.answer);
                } else if (res.error !== undefined) {
                  this.sendErrorAiAssistant(eM.generate.title, res.error.message);
                  this.closeMenu();
                } else {
                  this.sendErrorAiAssistant(eM.generate.title, eM.generate.default);
                  this.closeMenu();
                }
              }).catch(() => {
                this.sendErrorAiAssistant(eM.generate.title, eM.generate.default);
                this.closeMenu();
              });
              break;

            default:
              break;
          }
        }
      },
    },
  },
};
</script>
<style scoped>
.assistant-result-actions-right .apply-text{
  display: flex;
  height: 32px;
  padding: 8px 18px;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border-radius: 24px;
  border: 1px solid var(--primary-green-1, #27B199);
  background: var(--primary-green-1, #27B199);
  color: var(--typograph-and-font-white, #FFF);
  text-align: center;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: 150%; /* 18px */
  letter-spacing: 0.06px;
  cursor: pointer;
}
.assistant-result-actions-right .regenerate{
  cursor: pointer;
  display: flex;
  height: 32px;
  padding: 8px 18px;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border-radius: 24px;
  border: 1px solid var(--primary-green-1, #27B199);
}
.assistant-result-actions-right{
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}
.assistant-result-actions-left{
  display: flex;
  height: 32px;
  padding: 8px 0px;
  justify-content: center;
  align-items: center;
  gap: 24px;
  border-radius: 6px;
  cursor: pointer;
}
.assistant-result-actions{
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
}
.assistant-result-loader{
  display: flex;
  align-items: center;
  gap: 8px;
}
.assistant-result-loader span{
  color: var(--typograph-and-font-text-field-empty, #A0A0A0);
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 140%; /* 19.6px */
  letter-spacing: 0.07px;
}
.assistant-result-loader img{
  width: 24px;
  height: 24px;
}
.assistant-result-wrapper{
  display: flex;
  padding: 16px;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  background: #ffffff;
  margin: 4px 16px;
  border-radius: 8px;
  box-shadow: 0px 8px 24px 0px rgba(0, 0, 0, 0.05);
}
.assistant-result-header-right{
  cursor:pointer;
}
.assistant-result-header-left{
  display: flex;
  align-items: center;
  gap: 8px;
}
.assistant-result-header-left *, .assistant-result-header-right *{
  margin: 0px;
}
.assistant-result-header{
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
}
.assistant-result-header-left .qc-icon{
  color:#27B199;
}

.menu-icon {
  position: relative;
  display: inline-block;
}

.menu-icon .menu-icon-name {
  visibility: hidden;
  width: 120px;
  background-color: black;
  color: #fff;
  font-size: 14px;
  text-align: center;
  border-radius: 6px;
  padding: 5px;
  position: absolute;
  z-index: 1;
  bottom: -110%; 
  left: 250%;
  margin-left: -60px;
  opacity: 0;
  transition: opacity 0.3s;
}

.menu-icon:hover .menu-icon-name {
  visibility: visible;
  opacity: 1;
}

.qcw-menu-popup {
  position: absolute;
  bottom: 100%;
  left: 100px;
  z-index: 1;
  background-color: #FFFFFF;
  box-shadow: 0px 4px 12px 0px #0A0A0A1A;
  border-radius: 6px;
  padding: 8px 0 0;
  height: 263px;
}

.qcw-menu-langs {
  list-style-type: none;
  padding: 0;
  margin: 0;
  width: 261px;
}

.qcw-item-langs  {
  padding: 0;
  cursor: pointer;
  max-height: 190px;
  overflow-y: auto;  
  margin-top: 6px;

} 
.qcw-item-langs li {
  padding: 8px 24px 8px 24px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}

.qcw-item-langs li:hover {
  background-color: #f5f5f5;
}

.qcw-filter {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 238px;
  margin:4px 12px;
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

</style>
