function GetFile(option) {
  const obj = {
    el: document.querySelector(option.el),
    callBack: option.callback || new Function(), //所选文件中其中一个处理完成回调
    complete: option.complete || new Function(), //所有文件处理完成回调
    accept: option.accept || 'image', //接收类型 [image|video|audio|text|*]
    type: option.type || 'file', //返回类型[file|blob|base64]
    compress: option.compress || false, //是否压缩
    acceptReg: new RegExp(),
    isComplete: 0,
    limitCount: option.limitCount || 1, //限制选择文件数量
    limitSize: option.limitSize || '5MB', //限制选择文件大小[number(kb|mb|gb)]
    limitLevel: 0,
    limitNum: 0,
    fileList: []
  }
  Object.assign(this, obj)
  this.init()
}
GetFile.prototype = {
  init() {
    let isComplete = this.isComplete
    this.acceptRule(this.accept)
    this.el.addEventListener('change', this.bindEvent.bind(this))
    Object.defineProperty(this, 'isComplete', {
      get: function () {
        return isComplete
      },
      set: function (val) {
        isComplete = val
        this.asyncFileComplete()
      }
    })
  },
  acceptRule(type) {
    const acceptArray = [{
        type: 'image',
        reg: /\/(?:bmp|jpeg|jpg|gif|psd|png|webp)/i,
        capture: 'camera',
        accept: 'image/*'
      },
      {
        type: 'video',
        reg: /\/(?:mp4|ogg|webm)/i,
        capture: 'camcorder',
        accept: 'video/*'
      },
      {
        type: 'txt',
        reg: /\/(?:txt|doc|docx)/i,
        capture: '',
        accept: 'text/*'
      },
      {
        type: 'audio',
        reg: /\/(?:ogg|mp3|wav)/i,
        capture: 'microphone',
        accept: 'audio/*'
      },
      {
        type: '*',
        reg: /\/\*/,
        capture: '',
        accept: '*'
      }
    ]
    const accept = acceptArray.filter(item => item.type === type)[0]
    this.acceptReg = accept.reg
    this.el.setAttribute('capture', accept.capture)
    this.el.setAttribute('accept', accept.accept)
    if (this.limitCount > 1) this.el.setAttribute('multiple', 'multiple')
  },
  bindEvent(e) {
    this.files = e.target.files
    const _this = this,
      fileList = Array.prototype.slice.call(this.files)
    if (fileList.length > this.limitCount) return alert('more than limit count')
    fileList.forEach(file => {
      if (!this.acceptReg.test(file.type))
        return alert('choose file type error')
      const limitMore = this.limitSizeCompute(file),
        reader = new FileReader()
      let url = URL.createObjectURL(file)
      if (limitMore && !_this.compress) return alert('more than limit size')
      reader.onload = async function () {
        let data = this.result
        const compressFun = _this[`compress${_this.accept}`]
        if (limitMore) data = await compressFun.call(_this, data)
        const base64Data = {
          data,
          type: file.type
        }
        if (String.prototype.toUpperCase.call(_this.type) === 'FILE') {
          if (limitMore) file = _this.dataURLtoFile(data, file.name)
          url = URL.createObjectURL(file)
          _this.asyncFileChange(file, url)
          _this.callBack(file, url)
        }
        if (String.prototype.toUpperCase.call(_this.type) === 'BASE64') {
          _this.asyncFileChange(base64Data, data)
          _this.callBack(base64Data, data)
        }
        if (String.prototype.toUpperCase.call(_this.type) == 'BLOB') {
          const blob = _this.fileToBlob(base64Data)
          url = URL.createObjectURL(blob)
          _this.asyncFileChange(blob, url)
          _this.callBack(blob, url)
        }
      }
      reader.readAsDataURL(file)
    })
  },

  limitSizeCompute(file) {
    const type = Object.prototype.toString.call(file),
      fileSize =
      type === '[object File]' ? file.size / 1.34 : file.length / 1.34,
      limit = this.limitSize.split(/(\d+)/g).filter(item => item),
      limitSize = parseInt(limit[0]),
      limitUnit = String.prototype.toUpperCase.call(limit[1])
    this.limitNum = limitSize
    let size = 0
    if (limitUnit === 'KB') {
      size = fileSize / 1024
      this.limitLevel = 1
    } else if (limitUnit === 'MB') {
      size = ~~((10 * fileSize) / 1024 / 1024) / 10
      this.limitLevel = 2
    } else if (limitUnit === 'GB') {
      size = ~~((1000 * fileSize) / 1024 / 1024 / 1024) / 1000
      this.limitLevel = 3
    }
    return size > limitSize
  },
  compressvideo(data) {
    //待完善
    return new Promise(resolve => {
      const len = this.limitNum * Math.pow(1024, this.limitLevel) + 22
      resolve(data.substring(0, len))
    })
  },
  compressimage(data, count = 0) {
    return new Promise(resolve => {
      count++
      const limitMore = this.limitSizeCompute(data)
      if (!limitMore || count > 3) return resolve(data)
      const canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d'),
        img = new Image()
      img.src = data
      img.onload = () => {
        const initSize = data.length
        let width = img.width,
          height = img.height
        const infoData = data.match(/data\:(.+);base64,/),
          len = data.length - infoData[0].length,
          type = infoData[1],
          ratio = parseFloat(
            len / 1.34 / (this.limitNum * Math.pow(1024, this.limitLevel))
          ).toFixed(2)
        canvas.width = width
        canvas.height = height
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, width, height)
        data = canvas.toDataURL(type, 1 / Math.cbrt(ratio))
        console.log('压缩前：' + initSize)
        console.log('压缩后：' + data.length)
        console.log(
          '压缩率：' + ~~((100 * (initSize - data.length)) / initSize) + '%'
        )
        canvas.width = canvas.height = 0
        this.compressimage(data, count).then(data => {
          resolve(data)
        })
      }
    })
  },
  fileToBlob(file) {
    //将file转为blob
    const bytes = atob(file.data.split(',')[1]),
      bytesCode = new ArrayBuffer(bytes.length),
      byteArray = new Uint8Array(bytesCode)
    for (var i = 0; i < bytes.length; i++) {
      byteArray[i] = bytes.charCodeAt(i)
    }
    var blob = this.getBlob([bytesCode], file.type)
    return blob
  },
  dataURLtoFile(dataurl, filename) {
    //将base64转换为文件
    const arr = dataurl.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      u8arr = new Uint8Array(n)
    let n = bstr.length
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, {
      type: mime
    })
  },
  asyncFileChange(file, url) {
    this.fileList.push({
      file: file,
      url: url
    })
    this.isComplete++
  },
  asyncFileComplete() {
    if (this.files.length === this.isComplete) this.complete(this.fileList)
  },
  getBlob: function (buffer, format) {
    try {
      return new Blob(buffer, {
        type: format
      })
    } catch (e) {
      const blob = new(window.BlobBuilder ||
        window.WebKitBlobBuilder ||
        window.MSBlobBuilder)()
      buffer.forEach(function (buf) {
        blob.append(buf)
      })
      return blob.getBlob(format)
    }
  }
}