const paginate = ( page, size ) => {
  
  const limit = size ? +size : 8;
  const offset = page ? page * limit : 0;
    
    return {
      offset,
      limit,
    };
  };

module.exports = paginate