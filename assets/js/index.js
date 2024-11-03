
// navigator.clipboard.readText()

async function pastePoint(/**@type {HTMLElement}*/el) {
    const re = /-?\d+\.\d+,\s-?\d+\.\d+/;
    var text = await navigator.clipboard.readText()
    
    if (re.test(text)) {
        text = text.split(",").map(d => parseFloat(d.trim()))
    }
    // 1.2, 10.1
    var lat = el.parentElement.querySelector("#lat")
    var lon = el.parentElement.querySelector("#lon")

    lat.value = text[0]
    lon.value = text[1]
}

function delPoint(/**@type {HTMLElement}*/el) {
    if (document.querySelectorAll('.point').length == 1) {
        el.parentElement.querySelector('#lat').value = ''
        el.parentElement.querySelector('#lon').value = ''
    } else {
        el.parentElement.remove()
        document.querySelectorAll('.point').forEach((d, e) => {
            d.id = e + 1
            d.querySelector('span').textContent = `Ponto ${e+1}`
        })
    }
}

function addPoint() {
    const cont = document.querySelector('.points-container')
    const button = document.querySelector('.add-point')
    const point_index = cont.children.length - 2

    button.insertAdjacentHTML('beforebegin', `
        <div class="point" id="${point_index}">
            <span>Ponto ${point_index}</span>
            <button onclick="delPoint(this)">Delete</button>
            <input type="text" placeholder="Latitude" id="lat">
            <input type="text" placeholder="Longitude" id="lon">
            <button onclick="pastePoint(this)">Paste</button>
        </div>
    `)
}

async function copyCell(/**@type {HTMLElement}*/el) {
    navigator.clipboard.writeText(el.textContent)
}

function goTo(link) {
    window.open(link, '_blank')
}

function copyTables() {    
    const tabs = [
        document.querySelectorAll('#table2 tbody tr:not(.head)'),
        document.querySelectorAll('#table3 tbody tr:not(.head)')
    ]

    var lines = [];
    tabs.forEach((xd, xe) => {
        xd.forEach((rd, re) => {
            rd.querySelectorAll('td').forEach((d, e) => {
                if (!lines[xe]) { lines[xe] = [] }
                if (!lines[xe][re])  { lines[xe][re] = [] }
                
                lines[xe][re].push(d.textContent);
            });
        });
    });

    var final = lines[0].map((d, e) => {
        return d.concat(lines[1][e].slice(1)).join("\t")
    }).join('\n').split(".").join(",")

    navigator.clipboard.writeText(final)
}

function copyData() {
    const tab1 = document.querySelectorAll('#table1 tbody tr:not(.head)')

    var lines = []
    tab1.forEach((rd, re) => {
        rd.querySelectorAll('td').forEach((d, e) => {
            if (!lines[re]) { lines[re] = [] }
            lines[re].push(d.textContent)
        })
    })

    const final = lines.map(d => d.join('\t')).join('\n').split('.').join(',')
    navigator.clipboard.writeText(final)
}

function generate() {
    function convertToUTM(lon, lat) {
        const gd = "+proj=longlat +datum=WGS84 +no_defs";
        const sirgas2000UTM = "+proj=utm +zone=23 +south +datum=SIRGAS2000 +units=m +no_defs";
        const [x, y] = proj4(gd, sirgas2000UTM, [lon, lat]);
        return [y, x];
    }
    function toGMS(decimalDegrees, isLat) {
        const isNegative = decimalDegrees < 0;
        decimalDegrees = Math.abs(decimalDegrees);
        const degrees = Math.floor(decimalDegrees);
        const decimalMinutes = (decimalDegrees - degrees) * 60;
        const minutes = Math.floor(decimalMinutes);
        const seconds = (decimalMinutes - minutes) * 60;
    
        let direction = '';
        if (isLat) {
            direction = isNegative ? 'S' : 'N';
        } else {
            direction = isNegative ? 'W' : 'E';
        }

        return `${direction} ${degrees}°${minutes}'${seconds.toFixed(2)}"`;
    }
    function hvsDist(coords1, coords2) {
        const toRad = (value) => value * Math.PI / 180;
    
        const lat1 = coords1[0];
        const lon1 = coords1[1];
        const lat2 = coords2[0];
        const lon2 = coords2[1];
    
        const R = 6371;
    
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
        const distance = R * c;
    
        return distance * 1000;
    }
    function calcAz(coord1, coord2) {
        const toRad = (value) => value * Math.PI / 180;
        const toDeg = (value) => value * 180 / Math.PI;
    
        const lat1 = toRad(coord1[0]);
        const lon1 = toRad(coord1[1]);
        const lat2 = toRad(coord2[0]);
        const lon2 = toRad(coord2[1]);
    
        const dLon = lon2 - lon1;
    
        const x = Math.sin(dLon) * Math.cos(lat2);
        const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
        let azimuth = toDeg(Math.atan2(x, y));
    
        if (azimuth < 0) {
            azimuth += 360;
        }
        azimuth = Math.abs(azimuth);

        const degrees = Math.floor(azimuth);
        const decimalMinutes = (azimuth - degrees) * 60;
        const minutes = Math.floor(decimalMinutes);
        const seconds = (decimalMinutes - minutes) * 60;

        return `${degrees}°${minutes}'${seconds.toFixed(2)}"`;
    }
    const utmZone = (lon) => Math.floor((lon + 180) / 6) + 1;
    const centralMeridian = (utmz) => (utmz * 6) - 183;

    // console.log(hvsDist([-14.343403713165147, -48.69713650103194], [-14.363245867509091, -48.697371021733744]))

    var perimeter = 0
    var distances = []
    var azis = []

    var coords = []
    var coordtoa = []

    var haveNaN = false
    document.querySelectorAll('.point').forEach(i => {
        var finals = {
            gd: [],
            gms: [],
            utm: [],
        }
        let i1 = parseFloat(i.querySelectorAll('input').item(0).value);
        let i2 = parseFloat(i.querySelectorAll('input').item(1).value);
        if (isNaN(i1)) { i1 = 0; haveNaN = true }
        if (isNaN(i2)) { i2 = 0; haveNaN = true }
        finals.gd = [i1, i2];
        
        finals.utm = convertToUTM(finals.gd[1], finals.gd[0]);
        finals.gms = [toGMS(finals.gd[0], true), toGMS(finals.gd[1])];

        coords.push(finals)

        coordtoa.push(finals.gd.slice().reverse());
    });
    coordtoa.push(coords[0].gd.slice().reverse())

    const tab1 = document.querySelector('#table1 tbody')
    const tab2 = document.querySelector('#table2 tbody')
    const tab3 = document.querySelector('#table3 tbody')
    const tab4 = document.querySelector('#table4 tbody')
    const tab5 = document.querySelector('#table5 tbody')
    const copybt23 = document.querySelector('.table-container .bt.b23')
    const copybt1 = document.querySelector('.table-container .bt.b1')
    const desc = document.querySelector('.table-container .description')
    // const map = document.querySelector('.map')

    if (haveNaN) {
        document.querySelector('.table-container').classList.remove('hidden')
        document.querySelector('.nan-err').classList.remove('hidden')

        tab1.parentElement.classList.add('hidden')
        tab2.parentElement.classList.add('hidden')
        tab3.parentElement.classList.add('hidden')
        tab4.parentElement.classList.add('hidden')
        tab5.parentElement.classList.add('hidden')
        copybt23.classList.add('hidden')
        copybt1.classList.add('hidden')
        desc.classList.add('hidden')
        // map.classList.add('hidden')
        return
    } else {
        document.querySelector('.nan-err').classList.add('hidden')
    }

    tab1.parentElement.classList.add('hidden')
    copybt1.classList.add('hidden')
    tab4.parentElement.classList.add('hidden')

    if (coords.length > 1) {
        var data = []
        tab1.querySelectorAll('tr:not(.head)').forEach(d => d.remove())
        
        for (var i = 0; (coords.length - 1) > i; i++) {
            data.push([coords[i].gd, coords[i+1].gd])
        }
        if (coords.length > 2) data.push([coords[coords.length - 1].gd, coords[0].gd])

        data.forEach((d, e) => {
            let row = document.createElement('tr');
            let fp = e
            let sp = (e+1 == data.length && coords.length > 2) ? 0 : e+1

            var vet = `P${fp+1} - P${sp+1}`;            
            var distance = hvsDist(d[0], d[1]);
            var azimute = calcAz(d[0], d[1]);
            azis.push(azimute)
            perimeter += distance
            distances.push(distance)

            row.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${vet}</td>`);
            row.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${distance.toFixed(2)}m</td>`);
            row.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${azimute}</td>`);
            tab1.insertAdjacentElement('beforeend', row);
        })

        tab1.parentElement.classList.remove('hidden')
        copybt1.classList.remove('hidden')
    }

    if (coords.length > 2) {
        const polygon = turf.polygon([coordtoa]);
        const area = turf.area(polygon);

        tab4.querySelectorAll("td").item(0).textContent = `${area.toFixed(2)}m²`
        tab4.querySelectorAll("td").item(1).textContent = `${perimeter.toFixed(2)}m`
        tab4.parentElement.classList.remove('hidden')

        var desct = `<strong>LIMITES e CONFRONTANTES</strong>: Inicia-se a descrição deste perímetro no `
        for (let i = 0; i < coords.length; i++) {
            desct += `ponto <strong>P${i + 1}</strong>, de coordenadas <strong>E ${coords[i].utm[0]}m</strong> e <strong>S ${coords[i].utm[1]}m</strong>; deste segue confrontando com <strong>PROPRIEDADE DE TERCEIROS</strong>, com azimute de <strong>${azis[i]}</strong> por uma distância de <strong>${distances[i].toFixed(2)}m</strong>, até o `
        }
        desct += `<strong>P1</strong>, onde teve início essa descrição.`
        desc.innerHTML = desct;
        
        desc.classList.remove('hidden');
    }

    tab2.parentElement.classList.remove('hidden')
    tab3.parentElement.classList.remove('hidden')
    
    tab2.querySelectorAll('tr:not(.head)').forEach(d => d.remove())
    tab3.querySelectorAll('tr:not(.head)').forEach(d => d.remove())

    coords.forEach((d, e) => {
        let row = document.createElement('tr');

        let thea = `https://www.google.com.br/maps?q=${d.gd[0]},${d.gd[1]}&hl=pt-BR&t=h&z=16`
        // let thea = `<a href="https://www.google.com.br/maps/@${d.gd[0]},${d.gd[1]},3042m">P${e+1}</a>`

        row.insertAdjacentHTML('beforeend', `<td class="go-to-point" onclick="goTo('${thea}')">P${e+1}</td>`);
        row.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${d.gd[0].toFixed(10)}</td>`);
        row.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${d.gms[0]}</td>`);
        row.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${d.utm[0].toFixed(10)}</td>`);
        tab2.insertAdjacentElement('beforeend', row);
        let row2 = document.createElement('tr');
        row2.insertAdjacentHTML('beforeend', `<td class="go-to-point" onclick="goTo('${thea}')">P${e+1}</td>`);
        row2.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${d.gd[1].toFixed(10)}</td>`);
        row2.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${d.gms[1]}</td>`);
        row2.insertAdjacentHTML('beforeend', `<td onclick="copyCell(this)">${d.utm[1].toFixed(10)}</td>`);
        tab3.insertAdjacentElement('beforeend', row2);
    });

    tab5.querySelectorAll("td").item(0).textContent = utmZone(coords[0].gd[1]);
    tab5.querySelectorAll("td").item(1).textContent = centralMeridian(utmZone(coords[0].gd[1]));
    tab5.parentElement.classList.remove('hidden')
    
    // map.innerHTML = `<iframe src="https://www.google.com/maps/embed?pb=!1m10!1m8!1m3!1d1821.7370428013062!2d${coords[0].gd[1]}!3d${coords[0].gd[0]}!3m2!1i1024!2i768!4f13.1!5e1!3m2!1spt-BR!2sbr!4v1722370241544!5m2!1spt-BR!2sbr" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
    // map.classList.remove('hidden')

    


    copybt23.classList.remove('hidden')
    document.querySelector('.table-container').classList.remove('hidden')
}


const dialogs = {
    about() {
        const dialog = document.createElement('div')
        dialog.className = "dialog"
        dialog.innerHTML = `

        `
    }
}

// 3 .     .
// 2 
// 1 .     .
//   1  2  3

// -2.498650958615303, -44.20396057301128
// -2.4987936559497053, -44.20270935469604
// -2.4993130741159604, -44.20360063349594
