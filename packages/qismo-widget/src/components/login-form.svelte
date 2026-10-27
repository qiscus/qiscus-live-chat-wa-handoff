<div class="qcw-cs-container">
    <div class="qcw-cs-wrapper">
        <span class="qcw-cs-close"><img src="https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/qismo/img/close-circle.svg"></span>
        <div class="qcw-cs-box-form">
            <div class="qismo-login-form__header">
                <h3>{config.formGreet}</h3>
                <p>Please fill the details below before chatting with us</p>
            </div>
            <form class="qismo-login-form__body" on:submit|preventDefault={login}>
                <div class="qismo-input">
                    <div class="icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <mask id="path-1-inside-1" fill="white">
                                <path d="M14 15C16.2397 13.9985 16.835 10.4131 16.835 7.74292C16.835 4.57129 15.1025 2 12.0002 2C8.89771 2 7.16528 4.57129 7.16528 7.74292C7.16528 10.4131 7.7605 13.9983 10 15C10 15.5 10 16 9.5 16.1299C9.5 16.1299 6.12354 16.3945 4.33984 18.2183C3.07837 19.5078 3 22 3 22H21C21 22 20.9216 19.5078 19.6602 18.2183C17.8765 16.3945 14.5 16.1299 14.5 16.1299C14 16 14 15.5 14 15Z"/>
                            </mask>
                            <path class="qismo-contact-icon" d="M14 15L13.3877 13.6307C12.8477 13.8721 12.5 14.4084 12.5 15H14ZM10 15H11.5C11.5 14.4085 11.1524 13.8722 10.6125 13.6307L10 15ZM9.5 16.1299L9.61721 17.6253L9.74909 17.615L9.87713 17.5817L9.5 16.1299ZM4.33984 18.2183L5.41211 19.2672L5.41221 19.2671L4.33984 18.2183ZM3 22L1.50074 21.9529L1.45209 23.5H3V22ZM21 22V23.5H22.5479L22.4993 21.9529L21 22ZM19.6602 18.2183L18.5878 19.2671L18.5879 19.2672L19.6602 18.2183ZM14.5 16.1299L14.1229 17.5817L14.2509 17.615L14.3828 17.6253L14.5 16.1299ZM15.335 7.74292C15.335 8.98868 15.1937 10.3865 14.8272 11.5448C14.448 12.7435 13.9272 13.3894 13.3877 13.6307L14.6123 16.3693C16.3126 15.6091 17.2092 13.9615 17.6875 12.4497C18.1786 10.8973 18.335 9.16732 18.335 7.74292H15.335ZM12.0002 3.5C13.0907 3.5 13.8663 3.93134 14.4039 4.61185C14.9703 5.32897 15.335 6.4133 15.335 7.74292H18.335C18.335 5.90091 17.8334 4.11378 16.7581 2.75235C15.6538 1.35431 14.0121 0.5 12.0002 0.5V3.5ZM8.66528 7.74292C8.66528 6.4133 9.02995 5.32898 9.59639 4.61187C10.1339 3.93137 10.9096 3.5 12.0002 3.5V0.5C9.98831 0.5 8.34655 1.35427 7.24223 2.75232C6.16683 4.11377 5.66528 5.90091 5.66528 7.74292H8.66528ZM10.6125 13.6307C10.073 13.3894 9.55219 12.7434 9.17297 11.5447C8.80656 10.3864 8.66528 8.98868 8.66528 7.74292H5.66528C5.66528 9.16733 5.82161 10.8972 6.31268 12.4496C6.79095 13.9614 7.68749 15.6088 9.38754 16.3693L10.6125 13.6307ZM8.5 15C8.5 15.1349 8.49943 15.2096 8.4954 15.2711C8.49141 15.3321 8.48705 15.3173 8.50346 15.2638C8.52223 15.2026 8.57584 15.0661 8.70904 14.9279C8.85039 14.7813 9.00908 14.7076 9.12287 14.6781L9.87713 17.5817C10.2409 17.4872 10.5871 17.3024 10.8691 17.0098C11.1429 16.7257 11.2903 16.4086 11.3715 16.1437C11.5134 15.6811 11.5 15.1838 11.5 15H8.5ZM9.5 16.1299C9.38279 14.6345 9.38241 14.6345 9.38203 14.6345C9.38188 14.6345 9.38148 14.6346 9.38118 14.6346C9.3806 14.6346 9.37995 14.6347 9.37926 14.6347C9.37788 14.6349 9.37628 14.635 9.37448 14.6351C9.37088 14.6354 9.36645 14.6358 9.36121 14.6363C9.35073 14.6372 9.33701 14.6384 9.3202 14.64C9.2866 14.6432 9.2406 14.6478 9.18343 14.6543C9.06923 14.6671 8.90977 14.6873 8.71513 14.7174C8.32756 14.7774 7.79147 14.8784 7.19021 15.0441C6.03144 15.3635 4.43566 15.975 3.26748 17.1694L5.41221 19.2671C6.02772 18.6378 7.01202 18.2051 7.9874 17.9362C8.45322 17.8078 8.87273 17.7287 9.17399 17.6821C9.32376 17.6589 9.44202 17.6441 9.51943 17.6354C9.55808 17.631 9.58636 17.6282 9.60309 17.6266C9.61145 17.6258 9.61691 17.6253 9.61931 17.6251C9.62052 17.625 9.62096 17.625 9.62061 17.625C9.62044 17.625 9.62007 17.6251 9.61951 17.6251C9.61922 17.6251 9.61889 17.6252 9.61851 17.6252C9.61832 17.6252 9.61799 17.6252 9.6179 17.6252C9.61756 17.6253 9.61721 17.6253 9.5 16.1299ZM3.26758 17.1693C2.34332 18.1142 1.93079 19.3904 1.73378 20.262C1.62947 20.7234 1.57207 21.1345 1.54041 21.4314C1.52448 21.5808 1.51481 21.7038 1.50901 21.7928C1.5061 21.8374 1.50416 21.8736 1.50288 21.9005C1.50224 21.914 1.50176 21.9252 1.50142 21.9339C1.50125 21.9383 1.50111 21.9421 1.501 21.9452C1.50094 21.9468 1.50089 21.9482 1.50085 21.9495C1.50083 21.9502 1.50081 21.9507 1.50079 21.9513C1.50078 21.9516 1.50077 21.952 1.50076 21.9521C1.50075 21.9525 1.50074 21.9529 3 22C4.49926 22.0471 4.49925 22.0475 4.49924 22.0478C4.49923 22.0479 4.49922 22.0483 4.49922 22.0485C4.4992 22.0489 4.49919 22.0492 4.49918 22.0496C4.49916 22.0502 4.49914 22.0508 4.49913 22.0511C4.4991 22.0519 4.49909 22.0521 4.49911 22.0517C4.49914 22.0509 4.49926 22.048 4.4995 22.0429C4.49998 22.0327 4.50095 22.0141 4.50265 21.988C4.50607 21.9356 4.51237 21.8538 4.5235 21.7495C4.54596 21.5388 4.58699 21.2462 4.65995 20.9234C4.8175 20.2265 5.07489 19.6119 5.41211 19.2672L3.26758 17.1693ZM3 23.5H21V20.5H3V23.5ZM21 22C22.4993 21.9529 22.4992 21.9525 22.4992 21.9521C22.4992 21.952 22.4992 21.9516 22.4992 21.9513C22.4992 21.9507 22.4992 21.9502 22.4992 21.9495C22.4991 21.9482 22.4991 21.9468 22.499 21.9452C22.4989 21.9421 22.4988 21.9383 22.4986 21.9339C22.4982 21.9252 22.4978 21.914 22.4971 21.9005C22.4958 21.8736 22.4939 21.8374 22.491 21.7928C22.4852 21.7038 22.4755 21.5808 22.4596 21.4314C22.4279 21.1345 22.3705 20.7234 22.2662 20.262C22.0692 19.3904 21.6567 18.1142 20.7324 17.1693L18.5879 19.2672C18.9251 19.6119 19.1825 20.2265 19.34 20.9234C19.413 21.2462 19.454 21.5388 19.4765 21.7495C19.4876 21.8538 19.4939 21.9356 19.4973 21.988C19.499 22.0141 19.5 22.0327 19.5005 22.0429C19.5007 22.048 19.5009 22.0509 19.5009 22.0517C19.5009 22.0521 19.5009 22.0519 19.5009 22.0511C19.5009 22.0508 19.5008 22.0502 19.5008 22.0496C19.5008 22.0492 19.5008 22.0489 19.5008 22.0485C19.5008 22.0483 19.5008 22.0479 19.5008 22.0478C19.5008 22.0475 19.5007 22.0471 21 22ZM20.7325 17.1694C19.5643 15.975 17.9686 15.3635 16.8098 15.0441C16.2085 14.8784 15.6724 14.7774 15.2849 14.7174C15.0902 14.6873 14.9308 14.6671 14.8166 14.6543C14.7594 14.6478 14.7134 14.6432 14.6798 14.64C14.663 14.6384 14.6493 14.6372 14.6388 14.6363C14.6336 14.6358 14.6291 14.6354 14.6255 14.6351C14.6237 14.635 14.6221 14.6349 14.6207 14.6347C14.62 14.6347 14.6194 14.6346 14.6188 14.6346C14.6185 14.6346 14.6181 14.6345 14.618 14.6345C14.6176 14.6345 14.6172 14.6345 14.5 16.1299C14.3828 17.6253 14.3824 17.6253 14.3821 17.6252C14.382 17.6252 14.3817 17.6252 14.3815 17.6252C14.3811 17.6252 14.3808 17.6251 14.3805 17.6251C14.3799 17.6251 14.3796 17.625 14.3794 17.625C14.379 17.625 14.3795 17.625 14.3807 17.6251C14.3831 17.6253 14.3886 17.6258 14.3969 17.6266C14.4136 17.6282 14.4419 17.631 14.4806 17.6354C14.558 17.6441 14.6762 17.6589 14.826 17.6821C15.1273 17.7287 15.5468 17.8078 16.0126 17.9362C16.988 18.2051 17.9723 18.6378 18.5878 19.2671L20.7325 17.1694ZM14.8771 14.6781C14.9909 14.7076 15.1496 14.7813 15.291 14.9279C15.4242 15.0661 15.4778 15.2026 15.4965 15.2638C15.513 15.3173 15.5086 15.3321 15.5046 15.2711C15.5006 15.2096 15.5 15.1349 15.5 15H12.5C12.5 15.1838 12.4866 15.6811 12.6285 16.1437C12.7097 16.4086 12.8571 16.7257 13.1309 17.0098C13.4129 17.3024 13.7591 17.4872 14.1229 17.5817L14.8771 14.6781Z" fill="white" mask="url(#path-1-inside-1)"/>
                        </svg>
                    </div>
                    <input type="text" placeholder="Type your name" id="inputname" bind:value={display_name}>
                </div>
                <div class="qismo-form-error qismo-name-error">Please provide display name</div>
                {#if customerIdentifier == 'email'}
                    <div class="qismo-input">
                        <div class="icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path class="qismo-email-icon" fill-rule="evenodd" clip-rule="evenodd" d="M15.8195 2.77898C13.9957 2.02356 11.9889 1.82591 10.0528 2.21102C8.11677 2.59613 6.33837 3.5467 4.94253 4.94254C3.54669 6.33837 2.59612 8.11678 2.21101 10.0529C1.8259 11.9889 2.02355 13.9957 2.77897 15.8195C3.53439 17.6432 4.81365 19.202 6.45498 20.2987C8.09631 21.3954 10.026 21.9808 12 21.9808V20.4808C10.3227 20.4808 8.68299 19.9834 7.28834 19.0515C5.89368 18.1196 4.80668 16.7951 4.16479 15.2455C3.5229 13.6958 3.35495 11.9906 3.68219 10.3455C4.00942 8.70038 4.81713 7.18925 6.00319 6.0032C7.18925 4.81714 8.70037 4.00943 10.3455 3.68219C11.9906 3.35496 13.6958 3.52291 15.2454 4.1648C16.7951 4.80669 18.1196 5.89369 19.0515 7.28834C19.9834 8.683 20.4808 10.3227 20.4808 12H21.9808C21.9808 10.026 21.3954 8.09632 20.2987 6.45499C19.202 4.81366 17.6432 3.5344 15.8195 2.77898ZM8.64743 12C8.64743 10.1484 10.1484 8.64745 12 8.64745C13.8516 8.64745 15.3526 10.1484 15.3526 12C15.3526 13.8516 13.8516 15.3526 12 15.3526C10.1484 15.3526 8.64743 13.8516 8.64743 12ZM17.812 16.8526C16.7832 16.8526 15.902 16.221 15.535 15.3244C14.6499 16.2651 13.3936 16.8526 12 16.8526C9.32 16.8526 7.14743 14.68 7.14743 12C7.14743 9.32002 9.32 7.14745 12 7.14745C14.68 7.14745 16.8526 9.32002 16.8526 12V14.3932C16.8526 14.923 17.2821 15.3526 17.812 15.3526C19.2859 15.3526 20.4808 14.1577 20.4808 12.6838V12H21.9808V12.6838C21.9808 14.9861 20.1143 16.8526 17.812 16.8526Z" fill="white"/>
                            </svg>
                        </div>
                        <input type="text" placeholder="Type your email address" id="inputEmail" bind:value={unique_id}>
                    </div>
                    <div class="qismo-form-error qismo-email-error">Please use valid email</div>
                {:else}
                    <div class="qismo-input" style="overflow: unset;">
                        <div class="icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path class="qismo-phone-icon" d="M6.42943 5.06718C4.57884 4.67266 2.54073 6.01341 3.09157 9.11542C4.95477 17.4571 14.7487 20.2423 17.4377 19.9837C19.5471 19.7809 20.4953 17.9796 20.8766 16.9908C21.3029 15.8852 20.6543 14.6695 18.464 14.0281C16.537 13.4637 15.9283 15.3369 16.0293 16.3923C10.9263 16.4569 8.1915 12.3527 7.46203 10.2928C9.92449 7.6273 8.3421 5.47492 6.42943 5.06718Z" stroke-width="1.5" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <input type="tel" id="inputPhone" placeholder="Type phone number" bind:value={unique_id}>
                    </div>
                    <div class="qismo-form-error qismo-email-error">Please use valid phone number</div>
                {/if}
                <button name="submitform" type="submit" class="qcw-cs-submit-form qismo-login-btn">Start Chatting</button>
            </form>
            <div class="qismo-copyright">Powered by <a href="https://www.qiscus.com" target="_blank">Qiscus</a></div>
        </div>
    </div>
</div>
<script>
import { createEventDispatcher } from 'svelte';
export let config;
let display_name, unique_id;
const customerIdentifier = config.customerIdentifierInputType;

const dispatch = createEventDispatcher();

function login() {
    dispatch('login', {
        display_name,
        unique_id
    });
}
</script>

<style>
@import url('https://rsms.me/inter/inter.css');
.qcw-cs-container, .qismo-extra, .qcw-container,
.qcw-cs-container input, .qcw-cs-container button { font-family: 'Inter', sans-serif; }
.qcw-cs-container, .qcw-cs-container *, .qcw-cs-container *:before, .qcw-cs-container *:after,
.qismo-extra, .qismo-extra *, .qismo-extra *:before, .qismo-extra *:after {
  box-sizing: border-box;
}

  .qcw-container {
    z-index: 999999;
  }

  .qcw-cs-container {
    color: #444;
    position: fixed;
    bottom: 20px;
    right: 42px;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: vertical;
    flex-direction: column;
    -webkit-box-align: end;
    align-items: flex-end;
    font-size: 16px;
    z-index: 999999;
  }

  .qcw-cs-container .qcw-cs-wrapper, .qcw-cs-container.qcw-cs-container--open .qcw-cs-wrapper {
    height: 510px;
    position: fixed;
  }

  .qcw-trigger-btn,
  .qcw-cs-trigger-button {
    background: #74c162;
    color: #fff;
    padding: 15px 19px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    cursor: pointer;
    transition: all .3s ease;
    box-shadow: 0 7px 16px rgba(46, 46, 46, .15);
    border: 0;
    outline: 0;
    font-family: 'Inter', sans-serif;
    font-size: 16px;
  }

  .qcw-trigger-btn img,
  .qcw-cs-trigger-button img {
    margin: 0;
    height: 24px;
    width: auto;
  }
  .qcw-trigger-btn>div { margin-left: 15px; }

  .qcw-cs-wrapper {
    width: 360px;
    height: 0;
    box-shadow: 0 7px 16px rgba(46, 46, 46, .15);
    transform: translateY(-20px);
    overflow: hidden;
    position: absolute;
    transition: all .15s ease-in-out;
    bottom: 77px;
    display: -webkit-box;
    display: flex;
    -webkit-box-align: center;
    align-items: center;
    -webkit-box-orient: vertical;
    -webkit-box-direction: normal;
    flex-direction: column;
  }

  .qcw-cs-wrapper .qcw-cs-close {
    position: absolute;
    right: 16px;
    top: 20px;
    color: #979797;
    font-size: 30px;
    z-index: 9000;
    cursor: pointer;
    display: none;
  }

  .qcw-cs-wrapper .qcw-cs-box-form label { margin-bottom: 0; }

  .qcw-cs-wrapper .qcw-cs-box-form h3 {
    margin-top: 5px;
    margin-bottom: 20px;
    font-weight: 600;
    font-size: 24px;
    line-height: 1.28;
    text-align: left;
    color: inherit;
  }

  .qcw-cs-wrapper .qcw-cs-box-form p {
    margin: 0;
    color: inherit;
  }

  .qcw-cs-wrapper .qcw-cs-box-form .qcw-cs-form-group {
    margin-bottom: 15px;
  }

  .qcw-cs-wrapper .qcw-cs-box-form .qcw-cs-form-group .qcw-cs-form-field {
    border-radius: 19px;
    border: 1px solid #ccc;
    padding: 4px 10px;
    width: 100%;
    outline: 0;
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s;
    font-size: 16px;
    height: 40px;
    box-sizing: border-box;
  }

  .qcw-cs-welcome .qcw-header {
    display: flex;
    flex-direction: column;
    padding: 32px;
    margin: -32px -32px 32px -32px;
    border-radius: 8px 8px 0 0;
  }
  .qcw-cs-welcome .qcw-header-avatar {
    position: absolute;
    top: -30px;
    border-radius: 50%;
    width: 54px;
    height: 54px;
    overflow: hidden;
}
.qcw-cs-welcome .qcw-header-avatar img {
  width: 54px;
  height: 54px;
}

  .qcw-cs-form-group.error {
    background: #c0392b;
    border-radius: 19px;
    color: #fff;
    padding: 2px 20px;
    text-align: center;
  }

  .qcw-cs-form-group.error span {
    font-size: 13px;
  }

  /* Welcome CSS */
  .qcw-cs-welcome {
    width: 360px;
    background: #FFF;
    border-radius: 8px;
    box-shadow: 0px 8px 24px rgba(51, 51, 51, 0.1);
    text-align: center;
    padding: 32px;
    position: relative;
  }
	.qcw-cs-welcome .qcw-user-display-name {
    font-size: 18px;
    font-weight: 600;
    width: 100%;
  }
  .qcw-cs-welcome .qcw-user-status {
    font-size: 12px;
  }
	/* .qcw-cs-welcome { */
	.qismo-extra {
    max-width: 360px;
    position: fixed;
    bottom: 77px;
    right: 42px;
    z-index: 800;
    background-color: transparent !important;
    border-radius: 19px;
		color : rgb(102, 102, 102);
    transform: translateY(-20px);
	}
	.qcw-welcome-text {
    font-size : 14px;
    background: #FFF;
	}
span.qcw-cs-close-welcome {
    cursor: pointer;
    position: absolute;
    top: -12px;
    right: -10px;
}

/** login form **/
.qismo-copyright {
  text-align: center;
  color: #5a5a5a;
  background: #FFF;
  font-size: 12px;
  padding: 7px;
  border-top: 1px solid #ddd;
}
.qismo-copyright a { color: #a3a3a3; }
.qcw-cs-box-form {
  background: #fff;
  border-radius: 8px;
  -webkit-box-shadow: 0px 20px 35px rgba(189,189,189,0.24);
  box-shadow: 0px 20px 35px rgba(189,189,189,0.24);
  overflow: hidden;
  max-width: 100%;
}
.qismo-login-form__header {
  padding: 36px;
  color: #fff;
  background: #74c162;
}
.qismo-login-form__header p {
  line-height: 21px;
  font-size: 14px;
}
.qismo-login-form__body {
  padding: 36px;
}
.qismo-input {
  background: #fff;
  -webkit-box-shadow: 0px 16px 32px rgba(95,169,142,0.12);
  box-shadow: 0px 16px 32px rgba(95,169,142,0.12);
  border-radius: 6px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  overflow: hidden;
  margin-bottom: 32px;
}
.qismo-input input, .qismo-input select {
  -webkit-box-flex: 1;
  -ms-flex: 1;
  flex: 1;
  border: 0;
  padding: 10px;
  outline: none;
  font-size: 16px;
  height: 48px;
}
.qismo-input select {color: #777777;}
.qismo-box-phone {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
}
.qismo-input.country {
  width: 130px;
  margin-right: 10px;
}
.qismo-input.country input,
.qismo-input.country select {
  width: 100%;
}
.qismo-iput ::placeholder {
  font-size: 16px;
  color: #c4c4c4;
}
.qismo-input .icon {
  background: rgba(116, 193, 98, .2);
  min-width: 48px;
  width: 48px;
  height: 48px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
}
.qismo-login-btn {
  background: #74c162;
  border-radius: 30px;
  padding: 14px 22px;
  box-shadow: 0px 7px 17px rgba(51, 51, 51, 0.07);
  border: 0;
  color: #fff;
  display: block;
  margin: 15px auto 0 auto;
  cursor: pointer;
  -webkit-transition: -webkit-transform 0.32s ease;
  transition: -webkit-transform 0.32s ease;
  transition: transform 0.32s ease;
  transition: transform 0.32s ease, -webkit-transform 0.32s ease;
  font-size: 16px;
}
.qismo-contact-icon, .qismo-email-icon { fill : #74c162; }
.qismo-phone-icon { stroke : #74c162; }
.qismo-form-error { display: none; color: #EE5757; font-size: 14px; margin-top: -23px; font-weight: normal; margin-bottom: 10px; }
.qismo-form-error--visible { display: block; }
.qismo-input-error.qismo-input .icon { background: rgba(255, 106, 119, 0.2)!important; }
.qismo-input-error .qismo-contact-icon, .qismo-input-error  .qismo-email-icon { fill: #EE5757; }
.qismo-input-error .qismo-phone-icon { stroke : #EE5757; }
</style>