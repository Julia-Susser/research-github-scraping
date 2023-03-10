const { Octokit } = require('@octokit/rest');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const fs = require('fs');
const { MaxPages } = require('./max-pages');
require("dotenv").config();


class GithubForksOverTime extends MaxPages{
  constructor(repoName) {
    super()
    this.repoName = repoName;
    [this.owner, this.repo] = this.repoName.split('/');
    this.repoName = this.owner+"-"+this.repo
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Replace YOUR-TOKEN with your GitHub personal access token
    this.folder = "../inputs/"+this.repoName
    this.csvFilePath = this.folder+"/forks.csv"
    this.searchParams = {
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
        headers: {
            "Accept":"application/vnd.github.star+json",
            'X-GitHub-Api-Version': '2022-11-28'
          }
      }
  }

  async writeInfo(){
    var data = await this.octokit.request('GET /repos/{owner}/{repo}', {
      owner: this.owner,
      repo: this.repo,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })    
    fs.writeFileSync(this.folder+"/info.json", JSON.stringify(data))
    var data = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: this.owner,
      repo: this.repo,
      path: 'README.md',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    data = data.data.content
    const decodedBuffer = Buffer.from(data, 'base64');
    data = decodedBuffer.toString();
    fs.writeFileSync(this.folder+"/README.md", data)
    console.log("here")
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  exists(){
    return fs.existsSync(this.folder)
  }
  async createFolder(){
    if (!fs.existsSync(this.folder)) {
      fs.mkdirSync(this.folder);
    } 
  }
  
  async getHeader(){
    const res = await this.performRequest()
    const data = await res.data[0];
    var keys = Object.keys(data)
    return keys
  }
  async runScraper() {
    this.createFolder()
    this.header = await this.getHeader()
    this.csvWriter = await this.makeCSVWriter(this.header)
    this.maxPages = await this.getMaxPages()
    await this.writeInfo()
    await this.performQueries()
  }

  async performQueries() {
    var start = 1
    var length = 10
    var count = 1
    console.log(this.maxPages)
    while (start <= this.maxPages){
        var length = Math.min(this.maxPages-start+1,length)
        this.resArray = await this.fetchQuery(start, length)
        this.parseResponse()
        var start = start+length
        if (count % 3==0){
          console.log("waiting")
          await new Promise(resolve => setTimeout(resolve, 50000));
          console.log("waiting")
        }
        count += 1
    }
  }

    async parseResponse(){
        this.resArray.map(res => this.write(res))
    }

    async write(res) {
        const records = await res.data;
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
        const res = await this.octokit.request('GET /repos/{owner}/{repo}/forks', params)
        return res
    }

}

//new GithubForksOverTime("huggingface/transformers")
module.exports = { GithubForksOverTime } ;
