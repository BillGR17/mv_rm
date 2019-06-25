/* eslint-disable no-console */
const fs = require("fs");
function check(l) {
  return new Promise((res, rej) => {
    fs.stat(l, function(e, s) {
      if (e) {
        rej(e);
      } else {
        res(s);
      }
    });
  });
}
//creates folder with permissions and recursive
function mkdir(l, perm) {
  return new Promise((res, rej) => {
    fs.mkdir(l, {
      recursive: true,
      mode: perm
    }, (e) => {
      if (e) {
        rej(e);
      } else {
        res();
      }
    });
  });
}
//changes permissions
function chmod(l, perm) {
  return new Promise((res, rej) => {
    fs.chmod(l, perm, (e) => {
      if (e) {
        rej(e);
      } else {
        res("New permissions for [" + l + "] have been changed to [" + perm + "]");
      }
    });
  });
}
//check if has access
function access(l) {
  return new Promise((res, rej) => {
    fs.access(l, fs.constants.W_OK | fs.constants.R_OK, (e) => {
      if (e) {
        rej(e);
      } else {
        res();
      }
    });
  });
}
//read files from directory
function readdir(l) {
  return new Promise((res, rej) => {
    fs.readdir(l, (e, f) => {
      if (e) {
        rej(e);
      } else {
        res(f);
      }
    });
  });
}
//move file to the new location
function move(m, l, f, allow) {
  return new Promise((res, rej) => {
    if (!fs.statSync(m + f).isDirectory() && !allow) {
      fs.rename(m + f, l + f, (e) => {
        if (e) {
          rej(e);
        } else {
          res("Moving file [" + f + "] from '" + m + "' to '" + l + "'");
        }
      });
    } else {
      rej("Skipping moving folder", m + f);
    }
  });
}
//delete file or folder
function rm(f) {
  return new Promise((res, rej) => {
    fs.unlink(f, (e) => {
      if (e) {
        rej(e);
      } else {
        res("Deleted " + f);
      }
    });
  });
}
//fix permissions number (from fs stat mode to standard Linux)
function permnumber(n) {
  return "0" + (n & parseInt("777", 8)).toString(8);
}
//check if exist and get all the info
//checks and fixes permissions or makes directory
async function chmk(loc, perm) {
  let r;
  //retries
  let rtry = 0;
  await check(loc).then(async (x) => {
    //check if readable and writable
    //if not catch error
    await access(loc).then(async () => {
      //get permissions
      let x_perm = permnumber(x.mode);
      //check if the permissions are correct
      if (perm !== x_perm) {
        console.log("Folder has wrong permissions " + x_perm + " instead of " + perm);
        await chmod(loc, perm).then((x) => {
          console.info(x);
        }).catch((e) => {
          r = e;
        });
      } else {
        //just report that the folder already exist
        console.info("Folder already exist");
      }
    }).catch(async (e) => {
      r = e;
    });
  }).catch(async (e) => {
    //if folder doesn't exist try try to create it
    //and retry the whole function
    //if it fails the second time it will throw error
    if (e.message.startsWith("ENOENT") && rtry < 3) {
      rtry++;
      await mkdir(loc, perm).then(() => {
        console.log("Created New Dir");
      }).catch(async (e) => {
        console.log("Couldn't Create New Dir", e);
        await chmk(loc, perm);
      });
    } else {
      r = e;
    }
  });
  //if it catches a serious error it will report it
  //so the other functions will stop
  return r;
}
//check directory then find files and move them
async function chfmv(mv, loc, files, allow) {
  let r;
  await check(mv).then(async () => {
    await access(mv).then(async () => {
      if (files && files.length) {
        for (let i = 0; i < files.length; i++) {
          await move(mv, loc, files[i], allow).then((d) => {
            console.log(d);
          }).catch((e) => {
            console.log(e);
          });
        }
      } else {
        await readdir(mv).then(async (f) => {
          for (let i = 0; i < f.length; i++) {
            await move(mv, loc, f[i], allow).then((d) => {
              console.log(d);
            }).catch((e) => {
              console.log(e);
            });
          }
        });
      }
    }).catch((e) => {
      r = e;
    });
  }).catch((e) => {
    r = e;
  });
  return r;
}
//read directory and delete files
async function readArem(p) {
  await check(p).then(async (x) => {
    if (x.isDirectory) {
      await readdir(p).then(async (f) => {
        //for each file check if its directory
        //then call this function again
        //otherwise remove file
        for (let i = 0; i < f.length; i++) {
          if (fs.statSync(p + f[i]).isDirectory()) {
            await readArem(p + f[i]);
          } else {
            await rm(p + f[i]);
          }
        }
        if (fs.statSync(p).isDirectory()) {
          fs.rmdirSync(p, (e) => {
            console.log(e);
          });
        } else {
          await rm(p);
        }
      }).catch((e) => {
        console.log(e);
      });
    } else {
      await rm(p);
    }
  }).catch((e) => {
    console.log(e);
  });
}
//check files + folders on new location if they have the right permissions;
async function chperm(l, perm, fperm) {
  await readdir(l).then(async (x) => {
    for (let i = 0; i < x.length; i++) {
      await check(l + x[i]).then(async (f) => {
        let f_perm = permnumber(f.mode);
        if (f.isDirectory() && f_perm !== perm) {
          await chmod(l + x[i], perm).then((d) => {
            console.log(d);
          }).catch((e) => {
            console.log(e);
          });
        } else if (!f.isDirectory() && f_perm !== fperm) {
          await chmod(l + x[i], fperm).then((d) => {
            console.log(d);
          }).catch((e) => {
            console.log(e);
          });
        }
      });
    }
  }).catch((e) => {
    console.log(e);
  });
}
//all the functions are called here
async function main(mv, loc, perm, fperm, files, allow) {
  //if error occurs catch it and stop functions
  let e, status = 0;
  e = await chmk(loc, perm);
  if (e) {
    console.log("Unable to continue because:\n" + e);
    status = 2;
  } else {
    e = await chfmv(mv, loc, files, allow);
    if (e) {
      console.log("Unable to continue because:\n" + e);
      status = 3;
    }
  }
  //remove old folder
  await readArem(mv);
  //check permissions and fix them on 
  //the new folder
  await chperm(loc, perm, fperm);
  return status;
}
//all the functions are called here
module.exports = (..._this) => {
  let status = 0;
  if (!_this[0] || !_this[1]) {
    console.error("Need old and new path");
    status = 1;
  } else {
    //file location adds / at the end if doesn't exist
    let mv = _this[0].replace(/\/?$/, "/");
    //new path adds / at the end if doesn't exist at the end
    let loc = _this[1].replace(/\/?$/, "/");
    //folder permissions
    let perm = (_this[2] && _this[2].permissions) ? _this[2].permissions : "0755";
    //file permissions
    let fperm = (_this[2] && _this[2].file_permissions) ? _this[2].file_permissions : "0644";
    //files to move
    let files = (_this[2] && _this[2].files) ? _this[2].files : [];
    //allow moving folders
    let allow = (_this[2] && _this[2].folders) ? _this[2].folders : false;
    status = main(mv, loc, perm, fperm, files, allow);
  }
  return status;
};
