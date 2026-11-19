# Website 

Code for my personal website hosted on [mayank26saxena.github.io](http://mayank26saxena.github.io/)

## Publishing a blog post

Every post is published with one script, from its folder in the project repo:

```bash
uv run bin/publish_post.py ../PROJECT/docs/blog --slug my-post --date 2026-12-01   # first time
uv run bin/publish_post.py ../PROJECT/docs/blog --slug my-post                     # republish
```

Add `--dry-run` to see which files would change. The page's `<h1>`, meta description and kicker set the title, list entry
and share image. The script never commits; review with `git diff`, then commit and push to publish.
