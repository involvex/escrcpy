# Add CLI Bin to @escrcpy/workspace

## Objective

Enable launching the application from the command line using the command `escrcpy` after linking the package.

## Proposed Solution

1. Create a `bin/cli.js` file in the root directory.
2. This script will execute `bun dev` (the project's main dev command) in the root context.
3. Add the `bin` field to the root `package.json`.

## Changes

### 1. Create `bin/cli.js`

Create a new file `bin/cli.js` with a shebang and logic to run the dev script.

```javascript
#!/usr/bin/env node
import {spawn} from 'node:child_process'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const child = spawn('bun', ['run', 'dev'], {
	cwd: rootDir,
	stdio: 'inherit',
	shell: true,
})

child.on('exit', code => {
	process.exit(code || 0)
})
```

### 2. Update `package.json`

Add the `bin` field to `package.json`:

```json
{
	"bin": {
		"escrcpy": "bin/cli.js"
	}
}
```

## Verification

1. Run `bun link` in the root.
2. Type `escrcpy` in any directory and verify it starts the dev process.
