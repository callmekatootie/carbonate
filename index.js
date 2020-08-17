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

  try {
    const res = await Axios.post(CARBON_API_URL, {
      code,
      ...CARBON_DEFAULT_SETTINGS,
      ...options
    }, {
      responseType: 'stream'
    })

    res.data.pipe(fs.createWriteStream(path.join(__dirname, `${uuid}${IMAGE_FILE_EXT}`)))

    // Return the file id
    return uuid
  } catch (error) {
    console.log('An error occurred when trying to generate image for the code')
    console.log(error)

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

  try {
    const res = await Axios.post(IMGUR_API_URL, form, {
      headers: {
        Authorization: `Client-ID ${clientId}`,
        ...form.getHeaders()
      }
    })

    return res.data.data.link
  } catch (error) {
    console.log('An error occurred when trying to upload image to imgur')
    console.log(error)

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

  return commentBody.replace(codeblock.block, `\n<p align="center"><img src="${imageUrl}"/></p>\n`)
}

/**
 * Updates the comment
 * @param {Object} comment Details about the comment
 */
async function updateComment (comment) {
  const githubToken = core.getInput('github-token')

  const octokit = github.getOctokit(githubToken)

  try {
    await octokit.issues.updateComment(comment)
  } catch (error) {
    console.log('Error occurred updating the comment')
    console.log(error)

    throw error
  }
}

/**
 * Main function
 */
async function execute () {
  let imageId
  let code
  const usePrettier = core.getInput('use-prettier') === 'true'
  const prettierParser = core.getInput('prettier-parser')
  let prettierOptions = {}
  let carbonOptions = {}

  try {
    prettierOptions = JSON.parse(core.getInput('prettier-options'))
  } catch (error) {
    console.log('Prettier options is not a valid JSON string. Falling back to default')
  }

  try {
    carbonOptions = JSON.parse(core.getInput('carbon-options'))
  } catch (error) {
    console.log('Carbon options is not a valid JSON string. Falling back to default')
  }

  try {
    const { body } = github.context.payload.comment
    const codeblocks = gcb(body)

    // TODO - Support more than 1 code block
    if (codeblocks.length !== 1) {
      console.log('No code block found or more than one code block found. Unsupported scenario for now')
      return
    }

    if (usePrettier) {
      code = formatCode(codeblocks[0].code, prettierOptions, prettierParser)
    } else {
      code = codeblocks[0].code
    }

    imageId = await generateImage(code, carbonOptions)

    const imageUrl = await uploadImage(imageId)

    console.log('The imgur url', imageUrl)

    const updatedComment = replaceCodeBlockWithImage(body, imageUrl)

    console.log('The updated comment is ', updatedComment)

    const commentDetails = {
      owner: github.context.payload.repository.owner.login,
      repo: github.context.payload.repository.name,
      comment_id: github.context.payload.comment.id,
      body: updatedComment
    }

    await updateComment(commentDetails)

    // TODO - Remove before publishing
    console.log('The event payload: ', JSON.stringify(github, null, 4))
  } catch (error) {
    core.setFailed(error.message)
  } finally {
    // Cleanup
    if (imageId) {
      await unlink(path.resolve(__dirname, `${imageId}${IMAGE_FILE_EXT}`))
    }
  }
}

execute()
