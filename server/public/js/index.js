const extractData = (data) => {
  const linkContainer = document.querySelector('#link-container');
  const mappedLinks = { company: [], management: [], trustStructure: [], videos: [], portfolios: [] };
  if (data.error) {
    const { details } = data;
    linkContainer.innerHTML = `<div>
    <p>Error: ${details.name}</p>
    <p>Reason: ${details.message}</p>
    </div>`
    return;
  }
  //assign data's to proper keys
  data.forEach((record) => {
    const { status, link, section } = record;
    mappedLinks[section].push({ link, status })
  })
  //render on dom
  const docuFrag = document.createDocumentFragment();
  for (let section in mappedLinks) {
    const headerText = document.createElement('h2'),
      innerList = document.createElement('ul'),
      innerFrag = document.createDocumentFragment();

    headerText.textContent = section;
    docuFrag.appendChild(headerText);
    for (let item of mappedLinks[section]) {
      const li = document.createElement('li'),
        statusText = document.createElement('span'),
        link = document.createElement('a');
      link.setAttribute('target', "_blank");
      //apply styling to status codes
      if (item.status < 300 && item.status >= 200) {
        statusText.classList.add('status', 'good')
      } else if (item.status < 400 && item.status >= 300) {
        statusText.classList.add('status', 'redirect')
      } else if (item.status < 500 && item.status >= 400) {
        statusText.classList.add('status', 'notfound')
      } else {
        statusText.classList.add('status')
      }

      statusText.textContent = item.status;
      link.href = item.link;
      link.textContent = item.link;
      li.appendChild(statusText);
      li.appendChild(link);
      innerFrag.appendChild(li);
    }
    innerList.appendChild(headerText);
    innerList.appendChild(innerFrag);
    docuFrag.appendChild(innerList);
  }
  linkContainer.appendChild(docuFrag);
}

const postData = (data) => {
  const spinner = document.querySelector('.spinner');

  spinner.classList.add('run');
  const postRequest = new Request("/home",
    {
      method: 'POST', body: JSON.stringify({ data }),
      headers: new Headers({
        'Content-Type': 'application/json'
      }),
    }
  );
  fetch(postRequest)
    .then((res) => {
      return res.json();
    })
    .then((res) => {
      spinner.classList.remove('run');
      extractData(res)
    })
    .catch((err) => {
      console.log(err)
      spinner.classList.remove('run');
    })
}

const dragFile = () => {
  const textArea = document.querySelector('.text-area');
  const linkContainer = document.querySelector('#link-container');
  textArea.addEventListener('drop', (evt) => {
    evt.preventDefault();
    linkContainer.innerHTML = "";
    var files = evt.dataTransfer.files; // FileList object.
    var reader = new FileReader();
    reader.addEventListener('load', (e) => {
      const data = e.target.result;
      textArea.value = data
      postData(data);
    })
    reader.readAsText(files[0], "UTF-8");
  })
}


(() => {
  dragFile();
})();