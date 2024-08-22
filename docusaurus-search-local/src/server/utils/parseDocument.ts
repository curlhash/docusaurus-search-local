import { blogPostContainerID } from "@docusaurus/utils-common";
import { ParsedDocument, ParsedDocumentSection } from "../../shared/interfaces";
import { getCondensedText } from "./getCondensedText";

const HEADINGS_ARR = ["h2", "h3"];
const HEADINGS = "h1 h2, h3";
const MAX_CONTENT_LEN = 100;
// const SUB_HEADINGS = "h2, h3";

const startsWithLetter = (str: string) => {
  const regex = /^[a-z]/i;
  return regex.test(str);
}

const extractHashtag = (str: string) => {
  const hashtagRegex = /#\w+(-\w+)*/;
  const match = str.match(hashtagRegex);
  return match ? match[0] : '';
}

export function parseDocument($: cheerio.Root, frontmatter: any): ParsedDocument {
  const $pageTitle = $("h1").first();
  const pageTitle = frontmatter.title ?? $pageTitle.text();
  let firstProbablePara = ''
  $("p").each((index, element) => {
    if (index === 0 || !startsWithLetter($(element).text()) || firstProbablePara) return
    firstProbablePara = $(element).text()
  })
  if (!(firstProbablePara && firstProbablePara.length > frontmatter.description.length)) {
    firstProbablePara = frontmatter.description
  }
  const description = firstProbablePara;
  const keywords = $("meta[name='keywords']").attr("content") || "";

  const sections: ParsedDocumentSection[] = [];
  const breadcrumb: string[] = [];

  const navbarActiveItem = $(".navbar__link--active");
  if (navbarActiveItem.length > 0) {
    breadcrumb.push(navbarActiveItem.eq(0).text().trim());
  }

  const menu = $(".main-wrapper .menu");
  // console.log("menu.length", menu.length);
  if (menu.length > 0) {
    const activeMenuItem = menu
      .eq(0)
      .find(".menu__link--sublist.menu__link--active");
    // console.log("activeMenuItem.length", activeMenuItem.length);
    activeMenuItem.each((_, element) => {
      breadcrumb.push($(element).text().trim());
    });
  }
  HEADINGS_ARR.forEach((heading) => {
    $(heading).each((_, element) => {
      const $h = $(element);
      // Remove elements that are marked as aria-hidden.
      // This is mainly done to remove anchors like this:
      // <a aria-hidden="true" tabindex="-1" class="hash-link" href="#first-subheader" title="Direct link to heading">#</a>
      let title = $h.text().trim();
      // replace all '`' with '' to avoid breaking the search index
      const sanitizedTitle = title.replace(/[,?\.!:;\/\\'"\[\]\{\}\(\)&@#$%^*|<>~`]/g, '');
      let hash = extractHashtag(title)
      if (!hash) {
        hash = `#${sanitizedTitle.toLocaleLowerCase().split(' ').join('-')}`;
      }
      // Find all content between h1 and h2/h3,
      // which is considered as the content section of page title.
      let $sectionElements = $([]);
      if ($h.is($pageTitle)) {
        const $header = $h.parent();
        let $firstElement;
        if ($header.is("header")) {
          $firstElement = $header;
        } else {
          $firstElement = $h;
        }
        const blogPost = $(`#${blogPostContainerID}`);
        if (blogPost.length) {
          // Simplify blog post.
          $firstElement = blogPost.children().first();
          $sectionElements = $firstElement.nextUntil(HEADINGS).addBack();
        } else {
          const $nextElements = $firstElement.nextAll();
          const $headings = $nextElements.filter(HEADINGS);
          if ($headings.length) {
            $sectionElements = $firstElement.nextUntil(HEADINGS);
          } else {
            for (const next of $nextElements.get()) {
              const $heading = $(next).find(HEADINGS);
              if ($heading.length) {
                $sectionElements = $sectionElements.add(
                  $heading.first().prevAll()
                );
                break;
              } else {
                $sectionElements = $sectionElements.add(next);
              }
            }
          }
        }
      } else {
        $sectionElements = $h.nextUntil(HEADINGS);
      }
      const content = getCondensedText($sectionElements.get(), $);
      // for highlighting the text
      const query = `?highlight=${title.length > content.length ? title : content.substring(0, MAX_CONTENT_LEN)}`;

      sections.push({
        title,
        hash,
        content,
        query
      });
    });
  })

  return { pageTitle, description, keywords, sections, breadcrumb };
}
