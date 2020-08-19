# Carbonate

Jazz up the code blocks in your issues. Generate beautiful images for them to make it easier to follow. Meant to be used as a Github Action.

**BEFORE**

![]()

**AFTER**

![]()

## Features

- Extracts the code block for the issue description / comment and generates images for them
- Inserts the image at the code block
- Retains the original code block as a collapsed detail
- Allows formatting the code using Prettier and controlling the styling of the images generated

## Not Yet Supported

- Generating images from multiple code blocks in the same issue description / comment
- Generating images after the issue description / comment has been edited

## Pre-requisites

[Register](https://api.imgur.com/oauth2/addclient) your application with Imgur to get a `client_id`. You will pass this as input to the action.

## Usage

```yaml
- name: Generate beautiful images for code blocks present in issues
  uses: callmekatootie/carbonate@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    imgur-client-id: ${{ secrets.IMGUR_CLIENT_ID }}
```

### Inputs

#### github-token

This is the environment variable [GITHUB_TOKEN](https://docs.github.com/en/actions/configuring-and-managing-workflows/authenticating-with-the-github_token#about-the-github_token-secret).

#### imgur-client-id

The `client_id` that you obtained after [registration](https://api.imgur.com/oauth2/addclient) with imgur. The action will be carrying out anonymous uploads. **Required**.

#### use-prettier

The action can use [Prettier](https://prettier.io/) to format the code block before the image is generated. Set this input's value to the String `'true'` if you want to use it or to the String `'false'` otherwise. **Default value is 'true'**

#### prettier-parser

This input is only read if `use-prettier` input is `'true'`. You will specify the [parser](https://prettier.io/docs/en/options.html#parser) that you want Prettier to use for formatting the code. **Default value is 'babel'**

#### prettier-options

This input is only read if `use-prettier` input is `'true'`. You can specify the format [options](https://prettier.io/docs/en/options.html) to use with Prettier. **You need to pass the options object as a JSON string**. If none is passed, the action will fall back to Prettier's default format options.

#### carbon-options

You can specify the Carbon image generation configuration options. See [this](https://github.com/petersolopov/carbonara#post-apicook) for a list of supported options. **You need to pass the options object as a JSON string**. If none is passed, the action will use the options defined in the `constants.js` file.

## References

- [Carbon](https://github.com/carbon-app/carbon) - Generate beautiful images for code
- [Carbonara](https://github.com/petersolopov/carbonara) - Unofficial API for Carbon
- [Imgur](https://apidocs.imgur.com/) - Generated images are stored in Imgur
- [Prettier](https://prettier.io) - Opinionated Code Formatter
