const core = require('@actions/core')
const github = require('@actions/github')
const gcb = require('gfm-code-blocks')
const { default: Axios } = require('axios')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const FormData = require('form-data')
const path = require('path')
const util = require('util')

const IMAGE_FILE_EXT = '.png'
const IMGUR_API_URL = 'https://api.imgur.com/3/image'
const CARBON_API_URL = 'https://carbonara.now.sh/api/cook'
const CARBON_DEFAULT_SETTINGS = {
  paddingVertical: '8px',
  paddingHorizontal: '13px',
  backgroundColor: 'rgba(171, 184, 195, 1)',
  dropShadow: true,
  dropShadowOffsetY: '20px',
  dropShadowBlurRadius: '68px',
  theme: 'one-dark',
  windowTheme: 'none',
  language: 'auto',
  fontFamily: 'Hack',
  fontSize: '14px',
  lineHeight: '133%',
  windowControls: true,
  widthAdjustment: true,
  lineNumbers: false,
  exportSize: '1x',
  watermark: false
}

const unlink = util.promisify(fs.unlink)

/**
 * Generates the image using Carbon's API
 * @param {String} code The code to generate image for
 */
async function generateImage (code) {
  const uuid = uuidv4()

  try {
    const res = await Axios.post(CARBON_API_URL, {
      code,
      ...CARBON_DEFAULT_SETTINGS
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

  return commentBody.replace(codeblock.block, `![](${imageUrl})`)
}

// /**
//  * Updates the comment
//  * @param {Object} comment Details about the comment
//  */
// async function updateComment (comment) {
//   const githubToken = core.getInput('github-token')

//   const octokit = github.getOctokit(githubToken)


// }

/**
 * Main function
 */
async function execute () {
  let imageId

  try {
    const { body } = github.context.payload.comment
    const codeblocks = gcb(body)

    // TODO - Support more than 1 code block
    if (codeblocks.length !== 1) {
      console.log('No code block found or more than one code block found. Unsupported scenario for now')
      return
    }

    imageId = await generateImage(codeblocks[0].code)

    const imageUrl = await uploadImage(imageId)

    console.log('The imgur url', imageUrl)

    const updatedComment = replaceCodeBlockWithImage(body)

    console.log('The updated comment is ', updatedComment)

    // const commentDetails = {
    //   owner: github.context.payload.repository.,
    //   repo:,
    //   comment_id:,
    //   body:
    // }

    // await updateComment()

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
