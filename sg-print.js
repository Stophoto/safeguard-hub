// Shared print helper for Safeguard printable pages.
// Browser security does not allow a web page to save a PDF directly, so
// the button opens the print dialog; choose "Save as PDF" there.
(function () {
  function printPage() {
    window.focus();
    window.print();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-print]");
    if (!button) return;
    event.preventDefault();
    printPage();
  });
})();
