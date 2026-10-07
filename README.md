# K Land map bundle

The interactive map that runs on https://www.kevinsilvester.com/kland, published here so the page
can load it from jsDelivr instead of carrying it inline (the inline copy was approximately 2.1 MB of
the page's 2.35 MB of HTML, so the browser could not cache it between visits).

kland-map.js is a verbatim extract of the script that was inline in the page's map code block. It is
loaded with defer, so the page's own markup is parsed first and behaviour is unchanged.

Content and artwork belong to Kevin Silvester. All rights reserved; this repository is a delivery
mechanism, not a grant of any licence.
