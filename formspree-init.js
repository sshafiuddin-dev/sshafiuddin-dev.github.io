// Queues the contact form setup until vendor/formspree-ajax.min.js (deferred) loads and runs it.
window.formspree = window.formspree || function () {
  (formspree.q = formspree.q || []).push(arguments);
};
formspree('initForm', { formElement: '#contact-form', formId: 'mrernorw' });
