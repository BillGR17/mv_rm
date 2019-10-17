# mv_rm
Moves files to a new folder and deletes the old folder afterwards  
  
## How to use:

```
const mv_rm = require("../main.js");
mv_rm("/path/old/", "/path/new", { //       set the old path and the new path
  permissions: "0755", //                   sets new folder permissions **defaul 0755**
  file_permissions: "0777", //              sets new file permissions **default 0644**
  files: ["this.jpg", "that.png"], //       get only these files (if this is empty then it will move all the files from the folder) **default []**
  folders: true //                          moves files with folders recursively **default false**
});

```
