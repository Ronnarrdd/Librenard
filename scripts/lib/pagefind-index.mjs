// Index Pagefind sur les pages wiki pre-rendues (recherche offline).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Genere l'index Pagefind dans <rootDir>/pagefind/.
 * @param {string} rootDir
 */
export async function buildPagefindIndex(rootDir) {
    const bin = path.join(rootDir, 'node_modules/pagefind/lib/runner/bin.cjs');
    const args = [
        bin,
        '--site', rootDir,
        '--glob', 'wiki/**/*.html',
        '--force-language', 'fr',
        '--exclude-selectors', 'nav,.footer,.wiki-search-results,.wiki-copy-btn,.skip-link,.burger-menu',
        '-q'
    ];

    try {
        await execFileAsync(process.execPath, args, { cwd: rootDir });
        console.log('Index Pagefind genere (pagefind/).');
    } catch (err) {
        console.warn(`Pagefind ignore : ${err.message}`);
    }
}
