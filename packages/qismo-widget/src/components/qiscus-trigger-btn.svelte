<script>
  export let label;
  export let icon;
  export let isMobile;
  export let buttonHasIcon;
  export let buttonHasText;
  export let backgroundColor;
  export let isButtonClose;
</script>

<div class="qcw-trigger-btn" style="background: {backgroundColor};" on:click>
  {#if buttonHasIcon || isMobile || (!buttonHasIcon && isButtonClose)}
    <img
      src={icon}
      alt="chat with us icon"
      style="width: 24px; height: 24px;"
    />
  {/if}
  {#if buttonHasText && !isMobile}
    <div>{label ? label : "Chat With Us"}</div>
  {/if}
</div>

<style>
  .qcw-trigger-btn {
    background: #01416c;
    color: #fff;
    padding: 20px;
    border-radius: 32px;
    line-height: 24px;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 7px 16px rgba(46, 46, 46, 0.15);
    border: 0;
    outline: 0;
    font-family: "Inter", sans-serif;
    font-style: normal;
    font-weight: 600;
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
  }
  .qcw-trigger-btn:hover {
    transform: translateY(-3px);
  }
  .qcw-trigger-btn img {
    width: 24px;
    height: 24px;
  }
</style>
