﻿using System;
using System.Data.Entity;
using System.Data.Entity.Infrastructure;
using System.Linq;
using Paladyne.DashboardCatalog.DataAccess.Contracts;

namespace Paladyne.DashboardCatalog.DataAccess.Repositories
{
    /// <summary>
    /// Generic base repository for data access.
    /// </summary>
    /// <typeparam name="T">Type of entity.</typeparam>
    public class RepositoryBase<T> : IRepository<T> where T : class
    {
        public RepositoryBase(DbContext context)
        {
            if (context == null)
            {
                throw new ArgumentNullException("context");
            }

            DbContext = context;
            DbSet = context.Set<T>();
        }

        protected DbContext DbContext { get; private set; }

        protected DbSet<T> DbSet { get; private set; }

        /// <summary>
        /// Gets all items of type T.
        /// </summary>
        /// <returns>
        /// The <see cref="IQueryable"/>.
        /// </returns>
        public virtual IQueryable<T> GetAll()
        {
            return DbSet;
        }

        /// <summary>
        /// Gets item by id.
        /// </summary>
        /// <param name="id"> Id of the entity. </param>
        /// <returns> The <see cref="T"/>. </returns>
        public virtual T GetById(int id)
        {
            return DbSet.Find(id);
        }

        /// <summary>
        /// Adds entity to the repository.
        /// </summary>
        /// <param name="entity">The entity of type <see cref="T"/>.</param>
        public virtual void Add(T entity)
        {
            DbEntityEntry entityEntry = DbContext.Entry(entity);
            if (entityEntry.State != EntityState.Detached)
            {
                entityEntry.State = EntityState.Added;
            }
            else
            {
                DbSet.Add(entity);
            }
        }

        /// <summary>
        /// Updates entity in the repository.
        /// </summary>
        /// <param name="entity">The entity of type <see cref="T"/>.</param>
        public virtual void Update(T entity)
        {
            DbEntityEntry entityEntry = DbContext.Entry(entity);
            if (entityEntry.State == EntityState.Detached)
            {
                DbSet.Attach(entity);
            }
            entityEntry.State = EntityState.Modified;
        }

        /// <summary>
        /// Deletes entity from the repository.
        /// </summary>
        /// <param name="entity">The entity of type <see cref="T"/>.</param>
        public virtual void Delete(T entity)
        {
            DbEntityEntry entityEntry = DbContext.Entry(entity);
            if (entityEntry.State != EntityState.Deleted)
            {
                entityEntry.State = EntityState.Deleted;
            }
            else
            {
                DbSet.Attach(entity);
                DbSet.Remove(entity);
            }
        }

        /// <summary>
        /// Deletes entity from the repository by id.
        /// </summary>
        /// <param name="id"> The id. </param>
        public virtual void Delete(int id)
        {
            var entity = GetById(id);
            if (entity == null)
            {
                return;
            }
            Delete(entity);
        }
    }
}