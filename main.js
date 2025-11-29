const fs = require("fs/promises");
const path = require("path");

// Helper to convert mode to octal string
const getPermNumber = (mode) => {
  return "0" + (mode & parseInt("777", 8)).toString(8);
};

// Check if a path exists and return its stats, or null if not found
const getStats = async (p) => {
  try {
    return await fs.stat(p);
  } catch (e) {
    return null;
  }
};

// Ensures destination directory exists with correct permissions
const ensureDir = async (loc, perm) => {
  try {
    const stats = await getStats(loc);

    if (stats) {
      const currentPerm = getPermNumber(stats.mode);
      if (currentPerm !== perm) {
        console.log(`Folder has wrong permissions ${currentPerm} instead of ${perm}`);
        await fs.chmod(loc, perm);
        console.info(`Permissions changed to [${perm}]`);
      } else {
        console.info("Folder already exists with correct permissions");
      }
    } else {
      await fs.mkdir(loc, {
        recursive: true,
        mode: perm
      });
      console.log("Created New Dir");
    }
    return null;
  } catch (e) {
    console.error("Error ensureDir:", e);
    return e;
  }
};

// Moves files from src to dest
const moveFiles = async (src, dest, files, allowFolders) => {
  try {
    const itemsToMove = (files && files.length) ? files : await fs.readdir(src);

    for (const item of itemsToMove) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);

      const stats = await getStats(srcPath);
      if (!stats) continue;

      if (!stats.isDirectory() || allowFolders) {
        await fs.rename(srcPath, destPath);
        console.log(`Moved [${item}] from "${src}" to "${dest}"`);
      } else {
        console.log(`Skipping moving folder: ${srcPath}`);
      }
    }
    return null;
  } catch (e) {
    return e;
  }
};

// Sets permissions for contents of the new location
const setContentPermissions = async (loc, dirPerm, filePerm) => {
  try {
    const items = await fs.readdir(loc);
    for (const item of items) {
      const itemPath = path.join(loc, item);
      const stats = await getStats(itemPath);

      if (stats) {
        const currentPerm = getPermNumber(stats.mode);
        const targetPerm = stats.isDirectory() ? dirPerm : filePerm;

        if (currentPerm !== targetPerm) {
          await fs.chmod(itemPath, targetPerm);
          console.log(`Fixed permissions for ${item} to ${targetPerm}`);
        }
      }
    }
  } catch (e) {
    console.log("Error in setContentPermissions:", e);
  }
};

// Main logic
const main = async (src, dest, dirPerm, filePerm, files, allowFolders) => {
  // 1. Ensure destination exists
  let err = await ensureDir(dest, dirPerm);
  if (err) {
    console.log("Unable to continue (Destination Error):\n", err);
    return 2;
  }

  // 2. Move files
  err = await moveFiles(src, dest, files, allowFolders);
  if (err) {
    console.log("Unable to continue (Move Error):\n", err);
    return 3;
  }

  // 3. Remove old folder
  try {
    await fs.rm(src, {
      recursive: true,
      force: true
    });
    console.log(`Deleted source: ${src}`);
  } catch (e) {
    console.log("Error deleting source:", e);
  }

  // 4. Fix permissions on destination contents
  await setContentPermissions(dest, dirPerm, filePerm);

  return 0;
};

module.exports = async (src, dest, options = {}) => {
  if (!src || !dest) {
    console.error("Need old and new path");
    return 1;
  }

  const srcPath = path.resolve(src);
  const destPath = path.resolve(dest);

  const dirPerm = options.permissions || "0755";
  const filePerm = options.file_permissions || "0644";
  const files = options.files || [];
  const allowFolders = options.folders || false;

  return await main(srcPath, destPath, dirPerm, filePerm, files, allowFolders);
};
