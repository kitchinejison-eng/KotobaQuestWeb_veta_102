/* Small shared theme reader. Main settings own writes to the same key. */
(function(){'use strict';try{var t=localStorage.getItem('kotobaquest_theme_v3');if(['blue','red','yellow','green','purple'].indexOf(t)>=0)document.body.setAttribute('data-theme',t);}catch(_){}})();
