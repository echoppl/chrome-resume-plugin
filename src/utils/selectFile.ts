const FILE_TYPES: Record<string, string[]> = {
  image: ['image/png', 'image/jpg', 'image/jpeg'],
  attachment: ['text/plain', 'image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', 'application/x-zip-compressed', 'application/vnd.ms-excel', 'application/x-rar-compressed', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'application/vnd.ms-powerpoint']
}

const input = document.createElement('input');
input.type = 'file';
input.style.cssText = 'height: 1px; width: 1px; position: fixed; opacity: 0;';
document.body.appendChild(input);

export interface FileOption {
  type?: string;
  multiple?: boolean;
  maxSize?: number;
  base64?: boolean;
}

export interface FileResult {
  name: string;
  size?: number;
  type?: string;
  data?: string;
}

export default async function selectFile(option: FileOption = {}): Promise<FileResult | FileResult[]> {
  let result: (File | FileResult)[] = [];
  const files = await selectFiles(option);
  
  if (option.base64) {
    result = await fileToBase64(files);
    result = await checkImageCompress(result as FileResult[]);
  } else {
    result = files;
  }
  
  setTimeout(() => { input.value = ''; }, 1000);
  
  return option.multiple ? result as FileResult[] : result[0] as FileResult;
}

function selectFiles(option: FileOption = {}): Promise<File[]> {
  const { type, multiple, maxSize } = option;
  input.multiple = !!multiple;
  input.accept = type ? FILE_TYPES[type]?.join(',') || '' : '';
  
  return new Promise((resolve, reject) => {
    input.onchange = () => {
      const files: File[] = [];
      const incorrect: number[] = [];
      const oversized: number[] = [];
      
      const fileList = input.files;
      const length = fileList?.length || 0;
      
      for (let i = 0; i < length; i++) {
        const file = fileList?.[i];
        if (file) {
          files.push(file);
          
          if (type && FILE_TYPES[type] && !FILE_TYPES[type].includes(file.type)) {
            incorrect.push(i);
          }
          
          if (maxSize && file.size > maxSize * 1024 * 1024) {
            oversized.push(i);
          }
        }
      }
      
      if (incorrect.length > 0) {
        reject(new Error(`第${incorrect.join('、')}个文件格式不满足要求，请重新选择文件`));
      } else if (oversized.length > 0) {
        reject(new Error(`第${oversized.join('、')}个文件大小超过${maxSize}MB，请重新选择文件`));
      } else {
        resolve(files);
      }
    };
    
    input.click();
  });
}

function fileToBase64(files: File[]): Promise<FileResult[]> {
  const promises: Promise<FileResult>[] = files.map((file) => {
    const { name, size, type } = file;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        resolve({ name, size, type, data: reader.result as string });
      };
    });
  });
  
  return Promise.all(promises);
}

function checkImageCompress(files: FileResult[]): Promise<FileResult[]> {
  const promises: Promise<FileResult>[] = files.map((item) => {
    if (item.type && FILE_TYPES.image.includes(item.type) && item.size && item.size / (1024 * 1024) > 1) {
      return compressImage(item);
    }
    return Promise.resolve(item);
  });
  
  return Promise.all(promises);
}

function compressImage(file: FileResult): Promise<FileResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = file.data || '';
    
    img.onload = () => {
      const { w, h } = getReducedSize(img, 1200);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, w, h);
        
        resolve({
          name: setFileName(file.name),
          data: canvas.toDataURL('image/png'),
        });
      } else {
        reject(new Error('无法获取画布上下文'));
      }
    };
    
    img.onerror = () => {
      reject(new Error('图片压缩失败'));
    };
  });
}

function getReducedSize(data: HTMLImageElement, size: number): { w: number; h: number } {
  if (data.height > data.width) {
    return {
      h: size,
      w: (size * data.width) / data.height,
    };
  }
  
  return {
    w: size,
    h: (size * data.height) / data.width,
  };
}

function setFileName(name: string): string {
  const parts = name.split('.');
  if (parts.length > 1) {
    parts[parts.length - 1] = 'png';
  }
  return parts.join('.');
}
