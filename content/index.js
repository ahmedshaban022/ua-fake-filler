// Public API surface used by the injected callers (background/popup).
'use strict';

window.UAFakeFiller = {
  run: (opts) => window.UAFakeFillerCore.run(opts),
  restore: () => window.UAFakeFillerCore.restore()
};
