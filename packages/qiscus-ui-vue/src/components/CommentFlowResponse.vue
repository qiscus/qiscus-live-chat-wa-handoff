<template lang="pug">
    div(class="qcw-flow-response")
        span() {{comment.message}}
        div(class="flow-response-container")
            table(class="flow-response-detail" )
                tr(v-for="(data, index) in flowData" :key="index")
                    td() {{data.type}}
                    td() {{shouldMaskValue ? '********' : data.value}}
</template>

<script>
export default {
  name: 'CommentFlowResponse',
  components: {},
  props: ['comment', 'core'],
  computed: {
    shouldMaskValue() {
      return this.core.UI.maskFlowResponse;
    },
    flowData() {
      try {
        const parsed = JSON.parse(this.comment.extras.interactive.nfm_reply.response_json || '{}');

        return Object.entries(parsed)
                    .filter(([key]) => key !== 'flow_token')
                    .map(([key, value]) => {
                      let sortOrder = 9999;
                      if (key.match(/^screen_\d+_.*_\d+$/)) {
                        const screenMatch = key.match(/^screen_(\d+)_/);
                        const fieldMatch = key.match(/_(\d+)$/);

                        const screenNum = screenMatch ? parseInt(screenMatch[1], 10) : 0;
                        const fieldNum = fieldMatch ? parseInt(fieldMatch[1], 10) : 0;

                        sortOrder = (screenNum * 1000) + fieldNum;
                      } else {
                        const numMatch = key.match(/(\d+)/);
                        if (numMatch) {
                          sortOrder = 10000 + parseInt(numMatch[1], 10);
                        }
                      }

                      const cleanedKey = key
                            .replace(/^screen_\d+_/, '')
                            .replace(/_\d+$/, '')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());

                      const cleanText = text =>
                            text
                                .replace(/^\d+_/, '')
                                .replace(/_\d+$/, '')
                                .replace(/_/g, ' ');

                      let cleanedValue;
                      if (Array.isArray(value)) {
                        cleanedValue = value.map(item => cleanText(item)).join(', ');
                      } else if (typeof value === 'string') {
                        cleanedValue = cleanText(value);
                      } else {
                        cleanedValue = String(value);
                      }

                      return { type: cleanedKey, value: cleanedValue, sortOrder };
                    })
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map(({ type, value }) => ({ type, value }));
      } catch (err) {
        console.error("Can't parse the json:", err);
        return [];
      }
    },
  },
};
</script>

<style>
.qcw-flow-response {
  display: inline-flex; 
  flex-direction: column;
  gap: 16px;
  margin-top: 6px;
  width: 100%;
}

.flow-response-detail {
    width: 100%;
    table-layout: auto;
    border-collapse: collapse; 
}

.flow-response-detail tr {
    border-bottom: solid 1px #ECECEC;
}

.flow-response-detail tr td:last-child {
    font-weight: 600;
    padding-right: 0px;
    width: 100%;
    color: #0A0A0A;
    word-break: break-all;
}

.flow-response-detail tr:last-child {
    border-bottom: transparent;
}

.flow-response-detail tr td:first-child {
    white-space: nowrap;
    padding-right: 12px;
    padding-left: 0px;
    color: #565656;
}

.flow-response-detail td {
    padding: 12px;
}

.flow-response-container {
    padding-inline: 12px;
    border: 1px solid #ECECEC;
    border-radius: 8px;
    background-color: #FAFAFA;
    width: 100%;
    max-width: 100%;
    min-width: 280px;
}

.flow-reply {
    display: flex;
    flex-direction: column;
    border-left: solid 8px #D78E08;
    background-color: #FAFAFA;
    border-radius: 8px;
    padding: 8px 16px;
    width: 100%;
    overflow: hidden;
    max-width: 100%;
    max-height: 240px;
}

.flow-reply .truncate-body {
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>