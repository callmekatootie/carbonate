const core = require('@actions/core')
const github = require('@actions/github')
const gcb = require('gfm-code-blocks')
const { default: Axios } = require('axios')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const FormData = require('form-data')
const path = require('path')
const util = require('util')
const prettier = require('prettier')
const {
  IMAGE_FILE_EXT,
  IMGUR_API_URL,
  CARBON_API_URL,
  CARBON_DEFAULT_SETTINGS
} = require('./constants')

const unlink = util.promisify(fs.unlink)

/**
 * Formats the code using prettier
 * @param {String} code The code block to format
 * @param {Object} options The Prettier options
 * @param {String} parser The Prettier parser
 */
function formatCode (code, options, parser) {
  return prettier.format(code, { ...options, parser })
}

/**
 * Generates the image using Carbon's API
 * @param {String} code The code to generate image for
 * @param {Object} options The {Unofficial} Carbon API options
 */
async function generateImage (code, options) {
  const uuid = uuidv4()

  core.info('Generating image from the code...')

  try {
    const res = await Axios.post(CARBON_API_URL, {
      code,
      ...CARBON_DEFAULT_SETTINGS,
      ...options
    }, {
      responseType: 'stream'
    })

    const writeStream = fs.createWriteStream(path.join(__dirname, `${uuid}${IMAGE_FILE_EXT}`))

    return new Promise((resolve, reject) => {
      let error

      res.data.pipe(writeStream)

      writeStream.on('error', (err) => {
        error = err
        core.error('An error occurred downloading the generated image from Carbon')
        core.debug(error)
        writeStream.close()
        reject(error)
      })

      writeStream.on('close', () => {
        if (!error) {
          // Return the file id
          resolve(uuid)
        }
      })
    })
  } catch (error) {
    core.error('An error occurred when trying to generate image for the code')
    core.debug(error)

    // Throw the error to abort the operation
    throw error
  }
}

/**
 * Uploads the image to Imgur
 * @param {String} imageId The uuid of the image
 */
async function uploadImage (imageId) {
  const clientId = core.getInput('imgur-client-id')

  const form = new FormData()
  form.append('image', fs.createReadStream(path.join(__dirname, `${imageId}${IMAGE_FILE_EXT}`)))

  core.info('Uploading image to imgur...')

  try {
    const res = await Axios.post(IMGUR_API_URL, form, {
      headers: {
        Authorization: `Client-ID ${clientId}`,
        ...form.getHeaders()
      }
    })

    return res.data.data.link
  } catch (error) {
    core.error('An error occurred when trying to upload image to imgur')
    core.debug(error)

    throw error
  }
}

/**
 * Replaces the code block in a comment with the
 * corresponding image's url
 * @param {String} commentBody The entire comment body
 * @param {String} imageUrl The image to replace the code block with
 */
function replaceCodeBlockWithImage (commentBody, imageUrl) {
  // TODO - Support more than one code block
  const codeblock = gcb(commentBody)[0]

  // ! DO NOT change the formatting for this constant's value
  // ! Intentionally set this way for the markdown to be correct during render
  const replaceWith = `\n<p align="center"><img src="${imageUrl}"/></p>\n\n---\n\n<details><summary>View raw code</summary>
<p>

${codeblock.block}

</p></details>\n\n---\n\n`

  return commentBody.replace(codeblock.block, replaceWith)
}

/**
 * Updates the comment
 * @param {Object} comment Details about the comment
 */
async function updateComment (comment) {
  const githubToken = core.getInput('github-token')

  const octokit = github.getOctokit(githubToken)

  core.info('Updating comment...')

  try {
    await octokit.issues.updateComment(comment)
  } catch (error) {
    core.error('Error occurred updating the comment')
    core.debug(error)

    throw error
  }
}

/**
 * Updates the issue
 * @param {Object} issue Details about the issue
 */
async function updateIssue (issue) {
  const githubToken = core.getInput('github-token')

  const octokit = github.getOctokit(githubToken)

  core.info('Updating issue...')

  try {
    await octokit.issues.update(issue)
  } catch (error) {
    core.error('Error occurred updating the issue')
    core.debug(error)

    throw error
  }
}

/**
 * Main function
 */
async function execute () {
  let imageId
  let code
  let body
  const usePrettier = core.getInput('use-prettier') === 'true'
  const prettierParser = core.getInput('prettier-parser')
  let prettierOptions = {}
  let carbonOptions = {}

  try {
    prettierOptions = JSON.parse(core.getInput('prettier-options'))
  } catch (error) {
    core.info('Prettier options is not passed or not a valid JSON string. Falling back to default')
  }

  try {
    carbonOptions = JSON.parse(core.getInput('carbon-options'))
  } catch (error) {
    core.info('Carbon options is not passed or not a valid JSON string. Falling back to default')
  }

  try {
    const { eventName, payload } = github.context

    if (eventName !== 'issues' && eventName !== 'issue_comment') {
      core.info(`Unsupported event ${eventName}`)

      return
    }

    if ((eventName === 'issues' && payload.action !== 'opened') ||
      (eventName === 'issue_comment' && payload.action !== 'created')) {
      core.info(`Unsupported type ${payload.action} for event ${eventName}`)

      return
    }

    if (eventName === 'issues') {
      body = payload.issue.body
    } else {
      body = payload.comment.body
    }

    const codeblocks = gcb(body)

    // TODO - Support more than one code block
    if (codeblocks.length !== 1) {
      core.info('No code block found or more than one code block found. Unsupported scenario for now. Quitting.')
      return
    }

    if (usePrettier) {
      code = formatCode(codeblocks[0].code, prettierOptions, prettierParser)
    } else {
      code = codeblocks[0].code
    }

    imageId = await generateImage(code, carbonOptions)

    const imageUrl = await uploadImage(imageId)

    core.debug(`The imgur url is ${imageUrl}`)

    const updatedComment = replaceCodeBlockWithImage(body, imageUrl)

    core.debug(`The updated comment is ${updateComment}`)

    const updates = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      body: updatedComment
    }

    if (eventName === 'issues') {
      updates.issue_number = payload.issue.number

      await updateIssue(updates)
    } else {
      updates.comment_id = payload.comment.id

      await updateComment(updates)
    }

    core.info('Task completed')
  } catch (error) {
    core.setFailed(error.message)
  } finally {
    core.startGroup('View event payload')
    core.debug(JSON.stringify(github, null, 4))
    core.endGroup()
    // Cleanup
    if (imageId) {
      await unlink(path.resolve(__dirname, `${imageId}${IMAGE_FILE_EXT}`))
    }
  }
}

execute()
