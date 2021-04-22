function parseName(img) {
    let result = {
        valid: false,
        year: null,
        month: null,
        day: null,
        author: null,
        date: null
    }
    const style = /(?<year>\d{4})-?(?<month>\d{2})-?(?<day>\d{2})(-(?<author>[\w\u4e00-\u9fa5]*))?\.\w+/g;
    let res = style.exec(img)
    if (res === null) {
        return result
    }
    result.valid = true
    result.year = res.groups.year
    result.month = res.groups.month
    result.day = res.groups.day
    result.date = `${result.year}-${result.month}-${result.day}`
    if (res.groups.author) {
        result.author = res.groups.author
    }
    return result
}

module.exports = parseName