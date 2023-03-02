const { Octokit } = require('@octokit/rest');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const fs = require('fs');
require("dotenv").config();

class GithubStarsOverTime {
  constructor(repoName) {
    this.repoName = "huggingface/transformers";
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Replace YOUR-TOKEN with your GitHub personal access token
    [this.owner, this.repo] = this.repoName.split('/');
    this.csvFilePath = "../inputs/"+this.owner+"-"+this.repo+".csv"
    this.searchParams = {
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
        headers: {
            "Accept":"application/vnd.github.star+json",
            'X-GitHub-Api-Version': '2022-11-28'
          }
      }
    this.getStarsOverTime()
}

  async getStarsOverTime(sinceDate, untilDate) {
    this.performRequest()
    this.csvWriter = await this.makeCSVWriter()
    this.maxPages = await this.getMaxPages()
    await this.performQueries()
}

  async performQueries() {
    var start = 400
    var length = 10
    this.maxPages = 500
    while (start < this.maxPages){
        var length = Math.min(this.maxPages-start+1,length)
        await new Promise(resolve => setTimeout(resolve, 100));
        this.resArray = await this.fetchQuery(start, length)
        this.parseResponse()
        var start = start+length
        
    }
  }

  async getMaxPages(){
    const res = await this.performRequest()
    return this.findMaxPages(res)
}
  async findMaxPages(res) {
    const linkHeader = res.headers.link;
    const lastPageLink = linkHeader ? linkHeader.match(/<([^>]*)>; rel="last"/) : null;
  
    if (lastPageLink) {
      const lastPageUrl = new URL(lastPageLink[1]);
      const lastPageParams = Object.fromEntries(lastPageUrl.searchParams.entries());
      const lastPage = parseInt(lastPageParams.page);
  
      return lastPage;
    } else {
      return 1;
    }
}
    async makeCSVWriter(){
        const res = await this.performRequest()
        const data = await res.data;
        var keys = Object.keys(data[0].user)
        keys.push("starred_at")
        var header = keys.map(key => {return {id:key, title:key}} )
        var headerrow = Object.values(keys.reduce((result, key, index) => {
            result[key] = keys[index];
            return result;
        }, []));
        
        return this.getCSVWriter(header,headerrow)
    }
    async getCSVWriter(header, headerrow, append=false){
        const fileExists = await fs.existsSync(this.csvFilePath);
        if (!append | !fileExists){
          await fs.writeFileSync(this.csvFilePath, headerrow.join(",")+"\n")
        }
        var params = {
          path: this.csvFilePath,
          header: header,
          append: true,
        }
        var csvWriter = createCsvWriter(params);
        return csvWriter
    }

    async parseResponse(){
        this.resArray.map(res => this.write(res))
    }

    async write(res) {
        const data = await res.data;
        const records = data.map(item => {
          var user = item.user
          user.starred_at = item.starred_at
          return user
        });
        await this.csvWriter.writeRecords(records);
    }


    async fetchQuery(start, length){
        const requestPages = Array.from({length: length}, (_, i) => i + start)
        console.log(requestPages)
        const resArray = await Promise.all(
            requestPages.map((page) => {
              return this.performRequest(page);
            })
          );
        return resArray
    }

    async performRequest(page=1){
        const params = this.searchParams
        params.page = page
        const res = await this.octokit.request('GET /repos/{owner}/{repo}/stargazers', params)
        return res
    }

}

new GithubStarsOverTime()
module.exports = GithubStarsOverTime;
